import { NextResponse } from "next/server";
import { addMessage } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const sessionId = (body.session_id || "").trim();
    const message = (body.message || "").trim();
    const sender = (body.sender || "human").trim();

    if (!sessionId || !message) {
      return NextResponse.json({ error: "session_id and message are required" }, { status: 400 });
    }

    const messageId = addMessage(sessionId, sender, message);
    return NextResponse.json({ status: "success", message_id: messageId });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Failed to add message" }, { status: 500 });
  }
}
