import { NextResponse } from "next/server";
import { addChunks, addDocument, getDocument } from "@/lib/db";
import { createDocId, extractTextFromFile, splitTextIntoChunks } from "@/lib/ingestion";
import { getEmbedding } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const name = file.name || "uploaded-file";
    const buffer = Buffer.from(await file.arrayBuffer());
    const text = await extractTextFromFile(name, buffer);
    const chunks = splitTextIntoChunks(text);

    const lname = name.toLowerCase();
    const docType = lname.endsWith(".pdf") ? "pdf" : lname.endsWith(".md") || lname.endsWith(".markdown") ? "md" : "txt";
    const docId = createDocId(`${name}:${text.slice(0, 400)}`);

    const existing = await getDocument(docId);
    if (existing) {
      return NextResponse.json(
        { error: "Document already ingested. Delete it first to re-upload." },
        { status: 409 }
      );
    }

    const dbChunks = [];
    for (let i = 0; i < chunks.length; i += 1) {
      const embedding = await getEmbedding(chunks[i]);
      dbChunks.push({
        id: `${docId}_${i}`,
        document_id: docId,
        chunk_index: i,
        content: chunks[i],
        embedding
      });
    }

    await addDocument({ id: docId, name, type: docType, content: text });
    await addChunks(dbChunks);

    return NextResponse.json({ status: "success", document_id: docId, chunks_count: chunks.length });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Ingestion failed" }, { status: 500 });
  }
}
