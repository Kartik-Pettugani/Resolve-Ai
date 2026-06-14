import { NextResponse } from "next/server";
import { addMessage, resolveEscalation } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  const { message } = await request.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: "Message required" }, { status: 400 });
  }
  const { sessionId } = await params;
  addMessage(sessionId, "human", message.trim());
  resolveEscalation(sessionId);
  return NextResponse.json({ status: "success" });
}
