import { getAllChunks, addChunks } from "./lib/db.js";
import { getEmbedding } from "./lib/rag.js";

async function main() {
  console.log("Starting embedding migration to Gemini...");
  try {
    const chunks = await getAllChunks();
    console.log(`Found ${chunks.length} chunks to migrate.`);
    if (chunks.length === 0) {
      console.log("No chunks found. Migration complete.");
      return;
    }

    const updatedChunks = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Re-embedding chunk ${i + 1}/${chunks.length} (ID: ${chunk.id})...`);
      const embedding = await getEmbedding(chunk.content);
      updatedChunks.push({
        id: chunk.id,
        document_id: chunk.document_id,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        embedding
      });
    }

    console.log("Saving new embeddings to Turso DB and Qdrant...");
    await addChunks(updatedChunks);
    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
