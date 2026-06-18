import { NextResponse } from "next/server";
import { addMessage, resolveEscalation } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const { message } = await request.json();
    if (!message?.trim()) {
      return NextResponse.json({ error: "Message required" }, { status: 400 });
    }
    const { sessionId } = await params;
    await addMessage(sessionId, "human", message.trim());
    await resolveEscalation(sessionId);
    return NextResponse.json({ status: "success" });
  } catch (err) {
    console.error("reply error:", err);
    return NextResponse.json({ error: "Failed to send reply" }, { status: 500 });
  }
}
