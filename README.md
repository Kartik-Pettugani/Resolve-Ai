# Resolve — Intelligent Customer Support Console

Resolve is a full-stack Next.js support platform that combines a context-aware Retrieval-Augmented Generation (RAG) chatbot with dynamic confidence monitoring and real-time human-agent escalation.

It features a premium, Zinc/Slate dark theme (`Inter` typography, blue accents, and polished glass panels) and is equipped with multi-provider AI support and vector database storage.

---

## Key Features

- **Operations Console Grid:** Unified workspace organizing **Analytics Snapshot**, **Confidence Threshold** settings, **Escalation Queue**, **Knowledge Base Management**, and **Top Unanswered Patterns** inside responsive cards.
- **RAG Confidence Escalations:** Parses similarity scores and auto-escalates to human support if below threshold.
- **Dynamic Model Provider Routing:**
  - **Gemini (`gemini-2.5-flash`):** Primary agent generator using `@google/genai`.
  - **Groq (`llama-3.1-8b-instant`):** Fallback agent using the OpenAI-compatible SDK endpoint.
  - **Local Template Answer Generator:** Fallback when API keys are not present.
- **Qdrant Vector Database Integration:** Chunks are vectorized using `@xenova/transformers` (`all-MiniLM-L6-v2`) and indexed in Qdrant's `support_chunks` collection (using cosine similarity).
- **SQLite Local Fallback:** Retains a robust local SQLite memory scanning RAG pipeline if Qdrant is not configured.
- **Human Agent override:** Support specialists can resolve escalations from the console, re-routing conversation control back to AI.
- **Feedback Loop:** Positive (+1) and negative (-1) thumbs on AI responses.

---

## Technology Stack

- **Framework:** Next.js (App Router, React server components)
- **Database:** SQLite (`better-sqlite3`) for relational session data, logs, and document metadata.
- **Vector Database:** Qdrant Cloud/Local REST client (`@qdrant/js-client-rest`).
- **Styling:** Zinc/Slate vanilla CSS theme (`app/globals.css`).

---

## Local Development Setup

### 1. Environment Configuration

Create a `.env.local` file in the root directory:

```env
# Gemini API Key (Primary Model)
GEMINI_API_KEY="your-gemini-api-key"

# Groq API Key (Fallback Model)
GROQ_API_KEY="your-groq-api-key"

# Optional: Qdrant Vector DB Configuration
QDRANT_URL="https://your-qdrant-cluster-url.aws.qdrant.io:6333"
QDRANT_API_KEY="your-qdrant-api-key"
```

### 2. Run the Server

```bash
# Install dependencies
npm install

# Run the local Next.js development server
npm run dev
```

The server will spin up on:
- Customer Support Chat: `http://localhost:3000` (or `http://localhost:3001`)
- Resolve Operations Console: `/admin`

---

## API Routes Index

### Customer & Chat
* `POST /api/chat` — Processes user inputs, performs semantic searches, and generates responses (or triggers human escalation).
* `GET /api/chat/history?session_id=...` — Returns the conversation message history and the active session agent mode.
* `POST /api/chat/feedback` — Submits thumbs up (+1) or thumbs down (-1) feedback values for a specific response.

### Knowledge Base Ingestion
* `GET /api/documents` — Lists all indexed documents with their name, type, indexing time, and vector chunk counts.
* `DELETE /api/documents?id=...` — Removes a document and prunes its associated chunks from Qdrant/SQLite.
* `POST /api/documents/ingest/file` — Ingests and vectorizes an uploaded document file (PDF, TXT, MD).
* `POST /api/documents/ingest/url` — Scrapes, chunks, and indexes a documentation URL.

### Operations Console
* `GET /api/admin/metrics` — Aggregates live session counts, queries, escalation ratios, topic distributions, and feedback metrics.
* `GET /api/admin/escalations` — Lists escalated tickets, reasons, summaries, and status states.
* `POST /api/admin/escalations/:sessionId/resolve` — Resolves human handoffs and re-routes session control back to AI.
* `GET /api/admin/config` — Retrieves the current RAG confidence score settings.
* `POST /api/admin/config` — Updates the minimum retrieval confidence score threshold.
