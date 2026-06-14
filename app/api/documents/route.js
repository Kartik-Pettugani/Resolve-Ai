import { NextResponse } from "next/server";
import { deleteDocument, getAllDocuments } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(getAllDocuments());
}

export async function DELETE(request) {
  const docId = request.nextUrl.searchParams.get("id")?.trim();
  if (!docId) {
    return NextResponse.json({ error: "id query param is required" }, { status: 400 });
  }
  await deleteDocument(docId);
  return NextResponse.json({ status: "success", message: `Document ${docId} deleted.` });
}
