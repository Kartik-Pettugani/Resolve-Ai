<p align="center">
  <img src="https://img.shields.io/badge/Next.js-15.3-black?style=for-the-badge&logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19.1-61DAFB?style=for-the-badge&logo=react&logoColor=white" alt="React" />
  <img src="https://img.shields.io/badge/Gemini_2.5_Flash-4285F4?style=for-the-badge&logo=google&logoColor=white" alt="Gemini" />
  <img src="https://img.shields.io/badge/Qdrant-FF6B6B?style=for-the-badge&logo=databricks&logoColor=white" alt="Qdrant" />
  <img src="https://img.shields.io/badge/Turso-121212?style=for-the-badge&logo=turso&logoColor=4FF8D2" alt="Turso" />
</p>

<h1 align="center">Resolve AI</h1>
<p align="center">
  <strong>Intelligent Customer Support Console</strong><br/>
  <em>A context-aware RAG chatbot with confidence-based escalation, live chat handoff, and a real-time admin analytics dashboard.</em>
</p>

<p align="center">
  <a href="#-core-features">Features</a> •
  <a href="#%EF%B8%8F-architecture">Architecture</a> •
  <a href="#-technology-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-api-reference">API Reference</a> •
  <a href="#-project-structure">Project Structure</a>
</p>

---

## 📋 Overview

Support teams spend **60–80% of their time** answering the same 20 questions. **Resolve AI** replaces Tier-1 support with a context-aware agent that triages incoming requests, resolves common issues autonomously, and escalates edge cases to human specialists with a complete context summary — so the human agent never has to re-read the entire thread.

Built as a full-stack **Next.js 15** application, Resolve combines:
- A **Retrieval-Augmented Generation (RAG)** pipeline over a product knowledge base
- **Confidence-based escalation** logic with structured handoff summaries
- A premium **live chat interface** with real-time AI ↔ Human state transitions
- An **admin analytics panel** showing query volume, resolution rate, topic distribution, and feedback metrics

---

## ✨ Core Features

### 1. RAG Knowledge Base
Ingest product docs, FAQs, and past resolved tickets. Documents are chunked with sentence-level splitting + overlap, vectorized using **MiniLM-L6-v2** (384-dim embeddings), and indexed in **Qdrant** with cosine similarity search.

| Ingestion Method | Supported Formats |
|---|---|
| File Upload | PDF, Markdown (`.md`), Plain Text (`.txt`) |
| URL Scraping | Any public HTML page (via Cheerio) |

### 2. Multi-Turn Memory
Full conversation context is maintained within each session. The system detects pronominal references (*"it"*, *"that"*, *"this"*, *"those"*) in follow-up questions and automatically rewrites the query with prior context — no need for the user to repeat themselves.

### 3. Confidence-Based Escalation
When retrieval confidence falls below a configurable threshold, the system:
- Auto-escalates to a human agent
- Generates a **structured handoff summary** containing: topic classification, escalation reason, session ID, last user query, and the last 8 conversation turns
- Detects **out-of-scope queries** (weather, sports, recipes, legal/medical advice, etc.) and routes them separately

### 4. Live Chat Interface
A polished web-based chat with:
- **Typing indicators** with animated dots
- **Message timestamps** on every bubble
- **Visual state badges** — `AI online` (green pulse) vs `Human connected` (violet pulse)
- **Framer Motion** micro-animations for message entry, welcome screen, and toast notifications
- **Starter prompts** for common query categories

### 5. Admin Analytics Panel
A full operations dashboard with:

| Panel | What It Shows |
|---|---|
| **KPI Cards** | Total sessions, total queries, AI resolution rate, CSAT score (with sparklines) |
| **Query Analytics** | 7-day bar chart of query volume trends |
| **Sentiment Pulse** | Donut chart of thumbs-up vs thumbs-down feedback |
| **Escalation Queue** | Active/resolved tickets with priority, sentiment, topic, and reply-to-resolve workflow |
| **Escalation by Topic** | Horizontal bar chart showing frequency distribution across classified topics |
| **Knowledge Base** | Document list with file upload zone and URL ingestion panel |
| **Settings** | Confidence threshold slider with real-time persist |

### 6. Feedback Loop
Thumbs-up (`+1`) and thumbs-down (`-1`) on every AI response. **Negative feedback automatically creates an escalation ticket** tagged `negative_feedback` for knowledge base review and improvement.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React 19)                  │
│  ┌──────────────────┐    ┌────────────────────────────┐ │
│  │   Chat Interface │    │   Admin Operations Console │ │
│  │  (Framer Motion) │    │  (Dashboard / KB / Config) │ │
│  └────────┬─────────┘    └─────────────┬──────────────┘ │
├───────────┼────────────────────────────┼────────────────┤
│           │     Next.js App Router     │                │
│  ┌────────▼────────┐  ┌───────────────▼──────────────┐  │
│  │  /api/chat       │  │  /api/admin/metrics          │  │
│  │  /api/chat/hist. │  │  /api/admin/escalations      │  │
│  │  /api/chat/fdbk  │  │  /api/admin/config           │  │
│  │  /api/documents  │  │  /api/admin/messages          │  │
│  └────────┬─────────┘  └───────────────┬──────────────┘  │
├───────────┼────────────────────────────┼────────────────┤
│           │        Core Engine         │                │
│  ┌────────▼────────────────────────────▼──────────────┐  │
│  │               RAG Pipeline (lib/rag.js)            │  │
│  │  Query Rewrite → Embed → Search → Generate → Store │  │
│  └───┬──────────┬──────────────┬──────────────────────┘  │
│      │          │              │                         │
│  ┌───▼────┐ ┌───▼──────┐ ┌────▼───────┐                │
│  │ Gemini │ │   Groq   │ │  Template  │   LLM Cascade  │
│  │ 2.5    │ │  Llama   │ │  Fallback  │   (auto-retry) │
│  │ Flash  │ │  3.1-8B  │ │            │                │
│  └────────┘ └──────────┘ └────────────┘                │
├────────────────────────────────────────────────────────┤
│                     Storage Layer                      │
│  ┌────────────────────┐  ┌──────────────────────────┐  │
│  │  Qdrant Cloud/Local│  │  Turso (libSQL Cloud)    │  │
│  │  (Vector Search)   │  │  (Sessions, Messages,    │  │
│  │  support_chunks    │  │   Escalations, Docs,     │  │
│  │  384-dim / Cosine  │  │   Chunks, Settings)      │  │
│  └────────────────────┘  └──────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### LLM Provider Cascade

The system uses a **three-tier fallback chain** to guarantee a response is always generated:

1. **Gemini 2.5 Flash** (primary) — via `@google/genai`
2. **Groq Llama 3.1-8B-Instant** (fallback) — via OpenAI-compatible SDK
3. **Template Answer Generator** (offline fallback) — extracts the best matching chunk directly when no API keys are configured

---

## 🔧 Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Framework** | Next.js 15 (App Router) | Full-stack React framework with file-based API routes |
| **Frontend** | React 19, Framer Motion | UI rendering with fluid micro-animations |
| **Styling** | Vanilla CSS (Dark Zinc/Slate theme) | Custom design system with Inter + Geist + JetBrains Mono typography |
| **Primary LLM** | Google Gemini 2.5 Flash | Response generation with grounded context |
| **Fallback LLM** | Groq (Llama 3.1-8B-Instant) | OpenAI-compatible fallback endpoint |
| **Embeddings** | Xenova/all-MiniLM-L6-v2 | 384-dimensional sentence embeddings (runs locally) |
| **Vector DB** | Qdrant (Cloud or Local) | Cosine similarity search over document chunks |
| **Relational DB** | Turso (libSQL) | Cloud-hosted SQLite-compatible database for persistent sessions, messages, escalations |
| **PDF Parsing** | pdf-parse | Extract text from uploaded PDF files |
| **Web Scraping** | Cheerio | Extract content from documentation URLs |
| **Icons** | Lucide React | Consistent icon system across the UI |

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** ≥ 18.x
- **npm** ≥ 9.x
- At least one API key (Gemini or Groq) for AI-powered responses

### 1. Clone the Repository

```bash
git clone https://github.com/Kartik-Pettugani/Resolve-Ai.git
cd Resolve-Ai
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

Copy the example environment file and add your API keys:

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:

```env
# Required — at least one AI provider
GEMINI_API_KEY=your_gemini_api_key_here
GROQ_API_KEY=your_groq_api_key_here

# Required — Turso cloud database for persistent storage
TURSO_DATABASE_URL=libsql://your-database-name.turso.io
TURSO_AUTH_TOKEN=your_turso_auth_token_here

# Optional — Qdrant for production-grade vector search
QDRANT_URL=https://your-cluster.aws.qdrant.io:6333
QDRANT_API_KEY=your_qdrant_api_key_here
```

> **Note:** If no API keys are provided, the system falls back to a template-based answer generator using the best-matching knowledge base chunk. If `TURSO_DATABASE_URL` is not set, the system falls back to a local SQLite file.

### 4. Start the Development Server

```bash
npm run dev
```

### 5. Access the Application

| Interface | URL |
|---|---|
| **Customer Chat** | [http://localhost:3000](http://localhost:3000) |
| **Admin Console** | [http://localhost:3000/admin](http://localhost:3000/admin) |

---

## 📡 API Reference

### Chat & Messaging

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/chat` | Process a user message — performs semantic search, generates a response (or triggers escalation) |
| `GET` | `/api/chat/history?session_id=...` | Retrieve conversation history and current agent mode for a session |
| `POST` | `/api/chat/feedback` | Submit thumbs-up (`+1`) or thumbs-down (`-1`) feedback for an AI response |

### Knowledge Base

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/documents` | List all indexed documents with metadata |
| `DELETE` | `/api/documents?id=...` | Delete a document and prune its vector chunks |
| `POST` | `/api/documents/ingest/file` | Upload and vectorize a document file (PDF, TXT, MD) |
| `POST` | `/api/documents/ingest/url` | Scrape, chunk, and index a documentation URL |

### Admin Operations

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/admin/metrics` | Aggregate analytics: sessions, queries, escalation ratios, topic distribution, feedback |
| `GET` | `/api/admin/escalations` | List all escalated tickets with status, reason, and summary |
| `POST` | `/api/admin/escalations/:sessionId/resolve` | Resolve an escalation and return session control to AI |
| `POST` | `/api/admin/escalations/:sessionId/reply` | Send a human reply to the user and auto-resolve the escalation |
| `GET` | `/api/admin/config` | Retrieve the current RAG confidence threshold |
| `POST` | `/api/admin/config` | Update the minimum retrieval confidence threshold |

---

## 🛡️ Rate Limiting

The public, LLM-backed endpoints are protected by a per-IP **sliding-window
rate limiter** (`lib/rateLimit.mjs`, enforced in `middleware.js`) to guard
against abuse and runaway API costs.

| Endpoint(s) | Limited |
|---|---|
| `POST /api/chat` and sub-routes | ✅ |
| `POST /api/documents/ingest/*` | ✅ |
| All other routes | — |

**Configuration** (`.env.local`):

```env
RATE_LIMIT_MAX=20          # max requests per client per window (default 20)
RATE_LIMIT_WINDOW_MS=60000 # window length in ms (default 60000 = 1 min)
```

Every limited response carries standard headers:

| Header | Meaning |
|---|---|
| `X-RateLimit-Limit` | Max requests allowed in the window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Unix epoch (seconds) when the window resets |
| `Retry-After` | Seconds to wait before retrying (on `429` only) |

When the limit is exceeded the API responds with `429 Too Many Requests` and a
JSON body `{ "error": "...", "retryAfter": <seconds> }`.

> **Note:** Limiter state is in-memory and per-instance — ideal for a single
> runtime. For a multi-instance deployment, back it with a shared store
> (Redis / Upstash). The logic is unit-tested via `npm test`.

---

## 📁 Project Structure

```
resolve-ai/
├── app/
│   ├── layout.js                 # Root layout with font imports
│   ├── page.js                   # Chat page (session management)
│   ├── globals.css               # Design system (Zinc/Slate dark theme)
│   ├── admin/
│   │   └── page.js               # Admin dashboard page
│   └── api/
│       ├── chat/
│       │   ├── route.js          # POST — process user message
│       │   ├── history/route.js  # GET  — session message history
│       │   └── feedback/route.js # POST — thumbs up/down
│       ├── documents/
│       │   ├── route.js          # GET/DELETE — document CRUD
│       │   └── ingest/
│       │       ├── file/route.js # POST — file upload ingestion
│       │       └── url/route.js  # POST — URL scraping ingestion
│       ├── admin/
│       │   ├── metrics/route.js  # GET — analytics aggregation
│       │   ├── escalations/
│       │   │   ├── route.js      # GET — list escalations
│       │   │   └── [sessionId]/
│       │   │       ├── resolve/route.js # POST — resolve ticket
│       │   │       └── reply/route.js   # POST — reply & resolve
│       │   ├── config/route.js   # GET/POST — confidence threshold
│       │   └── messages/route.js # POST — admin message injection
│       └── health/route.js       # GET — health check
├── components/
│   ├── ChatInterface.jsx         # Live chat UI component
│   ├── AdminDashboard.jsx        # Full admin operations panel
│   ├── BackgroundOrbs.jsx        # Ambient animated background
│   └── Logo.jsx                  # Brand logo component
├── lib/
│   ├── rag.js                    # RAG pipeline: embed, retrieve, generate
│   ├── db.js                     # Turso/libSQL client: schema, CRUD, analytics queries
│   ├── qdrant.js                 # Qdrant client: upsert, search, delete
│   ├── ingestion.js              # Text extraction, chunking, doc ID generation
│   ├── rateLimit.mjs             # Sliding-window rate limiter (per-IP)
│   └── rateLimit.test.mjs        # Unit tests (node --test)
├── data/                          # Local SQLite fallback (when TURSO_DATABASE_URL not set)
├── .env.local.example            # Environment variable template
├── instrumentation.js            # Next.js instrumentation hook
├── next.config.mjs               # Next.js configuration
└── package.json                  # Dependencies and scripts
```

---

## 🎨 Design System

The UI uses a custom **Zinc/Slate dark theme** with:

- **Typography**: Geist (headings), Inter (body), JetBrains Mono (code/badges)
- **Color Palette**: Blue accents (`#b0c6ff`), violet secondary (`#d0bcff`), cyan highlights
- **Glass Panels**: Semi-transparent surfaces with subtle border treatments
- **Animations**: Spring-based Framer Motion transitions throughout

