import { NextResponse } from "next/server";
import { addChunks, addDocument } from "@/lib/db";
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

    const docType = name.toLowerCase().endsWith(".pdf") ? "pdf" : "md";
    const docId = createDocId(`${name}:${text.slice(0, 400)}`);

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

    addDocument({ id: docId, name, type: docType, content: text });
    addChunks(dbChunks);

    return NextResponse.json({ status: "success", document_id: docId, chunks_count: chunks.length });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Ingestion failed" }, { status: 500 });
  }
}
