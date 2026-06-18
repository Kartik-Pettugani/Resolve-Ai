import { NextResponse } from "next/server";
import { getConfidenceThreshold, setConfidenceThreshold } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ confidence_threshold: await getConfidenceThreshold() });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const value = Number(body.confidence_threshold);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      return NextResponse.json({ error: "confidence_threshold must be in [0,1]" }, { status: 400 });
    }
    const updated = await setConfidenceThreshold(value);
    return NextResponse.json({ status: "success", config: { confidence_threshold: updated } });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Invalid payload" }, { status: 400 });
  }
}
