import { NextResponse } from "next/server";
import { getAnalyticsMetrics } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getAnalyticsMetrics());
}
