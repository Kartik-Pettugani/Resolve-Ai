import { NextResponse } from "next/server";
import { SignJWT } from "jose";

export async function POST(request) {
  try {
    const body = await request.json();
    const email = (body.email || "").trim();
    const password = body.password || "";

    let role = null;
    if (email === "user@resolve.ai" && password === "Resolve@123") {
      role = "user";
    } else if (email === "admin@resolve.ai" && password === "Resolve@123") {
      role = "admin";
    }

    if (!role) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const secret = new TextEncoder().encode(process.env.JWT_SECRET || "default_jwt_secret_key_if_none_is_provided");
    const token = await new SignJWT({ email, role })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(secret);

    const response = NextResponse.json({ success: true, role });
    
    response.cookies.set("resolve_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
      path: "/",
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message || "Login failed" }, { status: 500 });
  }
}
