import { NextResponse } from "next/server";
import { getOrCreateSession, getSessionMessages } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request) {
  const sessionId = request.nextUrl.searchParams.get("session_id")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "session_id is required" }, { status: 400 });
  }

  const session = await getOrCreateSession(sessionId);
  const messages = await getSessionMessages(sessionId);

  return NextResponse.json({
    session_id: sessionId,
    status: session.status,
    messages
  });
}
