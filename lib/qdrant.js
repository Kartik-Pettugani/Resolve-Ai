import crypto from "node:crypto";
import { QdrantClient } from "@qdrant/js-client-rest";

const COLLECTION_NAME = "support_chunks";

// Setup Qdrant Client if configured
const qdrantUrl = process.env.QDRANT_URL || "";
const qdrantApiKey = process.env.QDRANT_API_KEY || "";

let client = null;

if (qdrantUrl) {
  try {
    client = new QdrantClient({
      url: qdrantUrl,
      apiKey: qdrantApiKey || undefined
    });
  } catch (error) {
    console.error("Failed to construct Qdrant client:", error);
  }
}

export function isQdrantEnabled() {
  return !!client;
}

/**
 * Deterministically generates a valid UUID v5-style string from an input string.
 * This ensures Qdrant gets valid UUIDs and re-indexing updates existing points.
 */
export function stringToUUID(str) {
  const hash = crypto.createHash("md5").update(str).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    hash.slice(12, 16),
    hash.slice(16, 20),
    hash.slice(20, 32)
  ].join("-");
}

/**
 * Initializes Qdrant collection support_chunks if it does not exist.
 */
export async function initQdrant() {
  if (!isQdrantEnabled()) {
    console.log("Qdrant is not configured. Falling back to SQLite for vector retrieval.");
    return;
  }

  try {
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);
    if (!exists) {
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 384,
          distance: "Cosine"
        }
      });
      console.log(`Qdrant collection '${COLLECTION_NAME}' created successfully.`);
    }
  } catch (error) {
    console.error("Failed to initialize Qdrant collection:", error);
  }
}

/**
 * Upsert chunks into Qdrant collection.
 * Chunks are formatted as: { id, document_id, chunk_index, content, embedding }
 */
export async function upsertChunksToQdrant(chunks) {
  if (!isQdrantEnabled()) return;

  try {
    // Ensure collection exists before upserting
    await initQdrant();

    const points = chunks.map((chunk) => ({
      id: stringToUUID(chunk.id),
      vector: chunk.embedding,
      payload: {
        id: chunk.id,
        document_id: chunk.document_id,
        chunk_index: chunk.chunk_index,
        content: chunk.content
      }
    }));

    await client.upsert(COLLECTION_NAME, {
      wait: true,
      points
    });
  } catch (error) {
    console.error("Failed to upsert chunks to Qdrant:", error);
  }
}

/**
 * Searches Qdrant for semantic similarity.
 * Returns { matches, maxSimilarity } or null if Qdrant fails or is not enabled.
 */
export async function searchChunksInQdrant(queryEmbedding, threshold = 0.4, topK = 4) {
  if (!isQdrantEnabled()) return null;

  try {
    const searchResult = await client.search(COLLECTION_NAME, {
      vector: queryEmbedding,
      limit: topK,
      with_payload: true
    });

    if (!searchResult || !searchResult.length) {
      return { matches: [], maxSimilarity: 0 };
    }

    const maxSimilarity = searchResult[0]?.score || 0;
    const matches = searchResult
      .map((r) => ({
        id: r.payload.id,
        document_id: r.payload.document_id,
        chunk_index: r.payload.chunk_index,
        content: r.payload.content,
        similarity: r.score
      }))
      .filter((m) => m.similarity >= threshold);

    return { matches, maxSimilarity };
  } catch (error) {
    console.error("Qdrant similarity search failed:", error);
    return null; // Signals caller to fallback
  }
}

/**
 * Deletes all chunks associated with a document_id from Qdrant.
 */
export async function deleteChunksFromQdrant(docId) {
  if (!isQdrantEnabled()) return;

  try {
    await client.delete(COLLECTION_NAME, {
      filter: {
        must: [
          {
            key: "document_id",
            match: {
              value: docId
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error(`Failed to delete chunks for document ${docId} from Qdrant:`, error);
  }
}
