import { NextResponse } from "next/server";
import { addChunks, addDocument } from "@/lib/db";
import { createDocId, extractTextFromUrl, splitTextIntoChunks } from "@/lib/ingestion";
import { getEmbedding } from "@/lib/rag";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const url = (body.url || "").trim();
    const name = (body.name || url).trim();

    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }

    const text = await extractTextFromUrl(url);
    const chunks = splitTextIntoChunks(text);
    const docId = createDocId(`${url}:${text.slice(0, 400)}`);

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

    await addDocument({ id: docId, name, type: "url", content: text });
    await addChunks(dbChunks);

    return NextResponse.json({ status: "success", document_id: docId, chunks_count: chunks.length });
  } catch (error) {
    return NextResponse.json({ error: error.message || "URL ingestion failed" }, { status: 500 });
  }
}
