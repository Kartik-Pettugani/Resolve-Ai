import { jwtVerify } from "jose";
import { NextResponse } from "next/server";

/**
 * In-memory sliding-window rate limiter.
 *
 * Protects the public, LLM-backed endpoints from abuse and cost runaway.
 * State lives in a module-level Map, so it is per-instance — adequate for a
 * single runtime, but a shared store (Redis / Upstash) should back this in a
 * multi-instance production deployment.
 */
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 20;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;

// Paths whose requests count against the rate limit.
const RATE_LIMITED_PREFIXES = ["/api/chat", "/api/documents/ingest"];

// key -> array of request timestamps (ms) within the current window
const rateLimitHits = new Map();

function isRateLimited(pathname) {
  return RATE_LIMITED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function clientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

/**
 * Records a hit for `key` and returns the limiter decision.
 * @returns {{ limited: boolean, retryAfter: number }}
 */
function checkRateLimit(key) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;

  const recent = (rateLimitHits.get(key) || []).filter((ts) => ts > windowStart);

  if (recent.length >= RATE_LIMIT_MAX) {
    const retryAfter = Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS - now) / 1000);
    rateLimitHits.set(key, recent);
    return { limited: true, retryAfter: Math.max(retryAfter, 1) };
  }

  recent.push(now);
  rateLimitHits.set(key, recent);
  return { limited: false, retryAfter: 0 };
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (isRateLimited(pathname)) {
    const { limited, retryAfter } = checkRateLimit(clientKey(request));
    if (limited) {
      return NextResponse.json(
        {
          error: "Too many requests. Please slow down and try again shortly.",
          retryAfter,
        },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }
  }

  const tokenCookie = request.cookies.get("resolve_token");
  const token = tokenCookie?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_jwt_secret_key_if_none_is_provided");
    const { payload } = await jwtVerify(token, secret);
    const role = payload.role;

    if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
      if (role !== "admin") {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        const url = request.nextUrl.clone();
        url.pathname = "/";
        return NextResponse.redirect(url);
      }
    }

    return NextResponse.next();
  } catch (err) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      response.cookies.delete("resolve_token");
      return response;
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const response = NextResponse.redirect(url);
    response.cookies.delete("resolve_token");
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/login (login API)
     * - login (login page)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - files inside public folder (like icon or images)
     */
    "/((?!api/login|login|_next/static|_next/image|favicon.ico|.*\\.png|.*\\.ico).*)",
  ],
};
