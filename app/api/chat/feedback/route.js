import { NextResponse } from "next/server";
import { createEscalation, getSessionMessages, updateMessageFeedback } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const messageId = Number(body.message_id);
    const feedback = Number(body.feedback);

    if (![-1, 0, 1].includes(feedback)) {
      return NextResponse.json({ error: "feedback must be -1, 0, or 1" }, { status: 400 });
    }

    const msg = await updateMessageFeedback(messageId, feedback);
    if (!msg) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    if (feedback === -1 && msg.sender === "ai") {
      const history = await getSessionMessages(msg.session_id);
      const summary = history
        .slice(-8)
        .map((m) => `${m.sender.toUpperCase()}: ${m.content}`)
        .join("\n");
      await createEscalation(
        msg.session_id,
        "negative_feedback",
        `Escalated due to thumbs-down feedback on AI response.\nConversation:\n${summary}`,
        "Feedback Review"
      );
    }

    return NextResponse.json({ status: "success", message: msg });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Unexpected error" }, { status: 500 });
  }
}
