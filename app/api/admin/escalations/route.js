import { NextResponse } from "next/server";
import { getAllEscalations } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getAllEscalations());
}
