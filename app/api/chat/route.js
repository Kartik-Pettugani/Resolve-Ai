import { NextResponse } from "next/server";
import { addMessage, getOrCreateSession } from "@/lib/db";
import { processSupportQuery } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionId = (body.session_id || "").trim();
    const userMessage = (body.message || "").trim();

    if (!sessionId || !userMessage) {
      return NextResponse.json({ error: "session_id and message are required" }, { status: 400 });
    }

    const session = await getOrCreateSession(sessionId);
    await addMessage(sessionId, "user", userMessage);

    if (session.status === "human") {
      const humanReply = "You are connected to human support. I am reviewing your previous context now.";
      await addMessage(sessionId, "human", humanReply);
      return NextResponse.json({
        response: humanReply,
        escalated: true,
        reason: "human_mode",
        similarity: 1
      });
    }

    const result = await processSupportQuery(sessionId, userMessage);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
