import { NextResponse } from "next/server";
import { addMessage, resolveEscalation } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(_request, { params }) {
  try {
    const { sessionId } = await params;
    await resolveEscalation(sessionId);
    await addMessage(sessionId, "system", "The support session has been resolved. You are now reconnected to AI assistant.");
    return NextResponse.json({ status: "success", message: `Escalation resolved for ${sessionId}` });
  } catch (err) {
    console.error("resolve escalation error:", err);
    return NextResponse.json({ error: "Failed to resolve escalation" }, { status: 500 });
  }
}
