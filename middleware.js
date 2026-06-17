import { jwtVerify } from "jose";
import { NextResponse } from "next/server";
import { rateLimit } from "./lib/rateLimit.mjs";

// Limits for the public, LLM-backed endpoints (configurable via env).
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX) || 20;
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 60_000;

// Paths whose requests count against the rate limit.
const RATE_LIMITED_PREFIXES = ["/api/chat", "/api/documents/ingest"];

function isRateLimited(pathname) {
  return RATE_LIMITED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function clientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  // Standard rate-limit headers to surface on responses for limited paths.
  let rateLimitHeaders = null;
  if (isRateLimited(pathname)) {
    const rl = rateLimit(clientKey(request), {
      max: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    rateLimitHeaders = {
      "X-RateLimit-Limit": String(rl.limit),
      "X-RateLimit-Remaining": String(rl.remaining),
      "X-RateLimit-Reset": String(Math.ceil(rl.reset / 1000)),
    };
    if (rl.limited) {
      return NextResponse.json(
        {
          error: "Too many requests. Please slow down and try again shortly.",
          retryAfter: rl.retryAfter,
        },
        {
          status: 429,
          headers: { ...rateLimitHeaders, "Retry-After": String(rl.retryAfter) },
        }
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

    const response = NextResponse.next();
    if (rateLimitHeaders) {
      for (const [key, value] of Object.entries(rateLimitHeaders)) {
        response.headers.set(key, value);
      }
    }
    return response;
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
