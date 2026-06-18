import { NextResponse } from "next/server";
import { getAnalyticsMetrics } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "7d";
  return NextResponse.json(await getAnalyticsMetrics(period));
}
