import { NextResponse } from "next/server";
import { addMessage, resolveEscalation } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_request, { params }) {
  const sessionId = params.sessionId;
  resolveEscalation(sessionId);
  addMessage(sessionId, "system", "The support session has been resolved. You are now reconnected to AI assistant.");
  return NextResponse.json({ status: "success", message: `Escalation resolved for ${sessionId}` });
}
