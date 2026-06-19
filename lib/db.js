import { createClient } from "@libsql/client";
import { upsertChunksToQdrant, deleteChunksFromQdrant } from "./qdrant.js";

if (!process.env.TURSO_DATABASE_URL) {
  throw new Error("TURSO_DATABASE_URL is not set. Copy .env.local.example to .env.local and fill in the values.");
}

let _db = null;
function getDb() {
  if (!_db) {
    _db = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    });
  }
  return _db;
}

let dbInitialized = false;
let dbInitPromise = null;

export async function initDb() {
  if (dbInitialized) return;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    await getDb().executeMultiple(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS document_chunks (
        id TEXT PRIMARY KEY,
        document_id TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES documents (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL DEFAULT 'ai',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        feedback INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS escalations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT UNIQUE NOT NULL,
        reason TEXT NOT NULL,
        summary TEXT NOT NULL,
        topic TEXT NOT NULL DEFAULT 'General',
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);

    const existing = await getDb().execute({
      sql: "SELECT value FROM settings WHERE key = ?",
      args: ["confidence_threshold"],
    });
    if (!existing.rows.length) {
      await getDb().execute({
        sql: "INSERT INTO settings (key, value) VALUES (?, ?)",
        args: ["confidence_threshold", "0.40"],
      });
    }

    dbInitialized = true;
  })();

  return dbInitPromise;
}

// Ensure DB is initialized before any operation
async function ensureDb() {
  await initDb();
}

function nowIso() {
  return new Date().toISOString();
}

export async function getConfidenceThreshold() {
  await ensureDb();
  const result = await getDb().execute({
    sql: "SELECT value FROM settings WHERE key = ?",
    args: ["confidence_threshold"],
  });
  return result.rows.length ? Number(result.rows[0].value) : 0.4;
}

export async function setConfidenceThreshold(value) {
  await ensureDb();
  await getDb().execute({
    sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: ["confidence_threshold", String(value)],
  });
  return getConfidenceThreshold();
}

export async function addDocument({ id, name, type, content }) {
  await ensureDb();
  await getDb().execute({
    sql: "INSERT OR REPLACE INTO documents (id, name, type, content, created_at) VALUES (?, ?, ?, ?, ?)",
    args: [id, name, type, content, nowIso()],
  });
}

export async function addChunks(chunks) {
  await ensureDb();
  const statements = chunks.map((row) => ({
    sql: "INSERT OR REPLACE INTO document_chunks (id, document_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?, ?)",
    args: [row.id, row.document_id, row.chunk_index, row.content, JSON.stringify(row.embedding)],
  }));
  await getDb().batch(statements);
  await upsertChunksToQdrant(chunks);
}

export async function getAllChunks() {
  await ensureDb();
  const result = await getDb().execute("SELECT id, document_id, chunk_index, content, embedding FROM document_chunks");
  return result.rows.map((r) => {
    try {
      return { ...r, embedding: JSON.parse(r.embedding) };
    } catch {
      return { ...r, embedding: [] };
    }
  });
}

export async function getDocument(id) {
  await ensureDb();
  const result = await getDb().execute({
    sql: "SELECT id, name FROM documents WHERE id = ?",
    args: [id],
  });
  return result.rows[0] || null;
}

export async function getAllDocuments() {
  await ensureDb();
  const result = await getDb().execute("SELECT id, name, type, created_at FROM documents ORDER BY created_at DESC");
  return result.rows;
}

export async function deleteDocument(docId) {
  await ensureDb();
  await getDb().execute({
    sql: "DELETE FROM document_chunks WHERE document_id = ?",
    args: [docId],
  });
  await getDb().execute({
    sql: "DELETE FROM documents WHERE id = ?",
    args: [docId],
  });
  await deleteChunksFromQdrant(docId);
}

export async function getOrCreateSession(sessionId) {
  await ensureDb();
  const found = await getDb().execute({
    sql: "SELECT id, status, created_at, updated_at FROM sessions WHERE id = ?",
    args: [sessionId],
  });
  if (found.rows.length) return found.rows[0];
  const ts = nowIso();
  await getDb().execute({
    sql: "INSERT INTO sessions (id, status, created_at, updated_at) VALUES (?, 'ai', ?, ?)",
    args: [sessionId, ts, ts],
  });
  const result = await getDb().execute({
    sql: "SELECT id, status, created_at, updated_at FROM sessions WHERE id = ?",
    args: [sessionId],
  });
  return result.rows[0];
}

export async function updateSessionStatus(sessionId, status) {
  await ensureDb();
  await getDb().execute({
    sql: "UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?",
    args: [status, nowIso(), sessionId],
  });
}

export async function addMessage(sessionId, sender, content) {
  await ensureDb();
  await getOrCreateSession(sessionId);
  const ts = nowIso();
  const result = await getDb().execute({
    sql: "INSERT INTO messages (session_id, sender, content, timestamp) VALUES (?, ?, ?, ?)",
    args: [sessionId, sender, content, ts],
  });
  await getDb().execute({
    sql: "UPDATE sessions SET updated_at = ? WHERE id = ?",
    args: [ts, sessionId],
  });
  return Number(result.lastInsertRowid);
}

export async function getSessionMessages(sessionId) {
  await ensureDb();
  const result = await getDb().execute({
    sql: "SELECT id, sender, content, timestamp, feedback FROM messages WHERE session_id = ? ORDER BY id ASC",
    args: [sessionId],
  });
  return result.rows;
}

export async function updateMessageFeedback(messageId, feedback) {
  await ensureDb();
  await getDb().execute({
    sql: "UPDATE messages SET feedback = ? WHERE id = ?",
    args: [feedback, messageId],
  });
  const result = await getDb().execute({
    sql: "SELECT id, session_id, sender, content, feedback FROM messages WHERE id = ?",
    args: [messageId],
  });
  return result.rows[0] || null;
}

export async function createEscalation(sessionId, reason, summary, topic) {
  await ensureDb();
  await updateSessionStatus(sessionId, "human");
  await getDb().execute({
    sql: "INSERT INTO escalations (session_id, reason, summary, topic, created_at, status) VALUES (?, ?, ?, ?, ?, 'pending') ON CONFLICT(session_id) DO UPDATE SET reason=excluded.reason, summary=excluded.summary, topic=excluded.topic, created_at=excluded.created_at, status='pending'",
    args: [sessionId, reason, summary, topic, nowIso()],
  });
}

export async function getAllEscalations() {
  await ensureDb();
  const result = await getDb().execute(
    `SELECT e.id, e.session_id, e.reason, e.summary, e.topic, e.created_at, e.status, s.status AS session_status
     FROM escalations e
     JOIN sessions s ON s.id = e.session_id
     ORDER BY e.created_at DESC`
  );
  return result.rows;
}

export async function resolveEscalation(sessionId) {
  await ensureDb();
  await updateSessionStatus(sessionId, "ai");
  await getDb().execute({
    sql: "UPDATE escalations SET status = 'resolved' WHERE session_id = ?",
    args: [sessionId],
  });
}

export async function getAnalyticsMetrics(period = "7d") {
  await ensureDb();

  const totalSessionsR = await getDb().execute("SELECT COUNT(*) AS c FROM sessions");
  const totalSessions = Number(totalSessionsR.rows[0].c);

  const totalQueriesR = await getDb().execute("SELECT COUNT(*) AS c FROM messages WHERE sender = 'user'");
  const totalQueries = Number(totalQueriesR.rows[0].c);

  const escalatedSessionsR = await getDb().execute("SELECT COUNT(*) AS c FROM escalations");
  const escalatedSessions = Number(escalatedSessionsR.rows[0].c);

  const resolutionRate = totalSessions > 0 ? ((totalSessions - escalatedSessions) / totalSessions) * 100 : 100;

  const topicsResult = await getDb().execute("SELECT topic, COUNT(*) AS c FROM escalations GROUP BY topic ORDER BY c DESC");
  const topics = Object.fromEntries(topicsResult.rows.map((r) => [r.topic, Number(r.c)]));

  const thumbsUpR = await getDb().execute("SELECT COUNT(*) AS c FROM messages WHERE sender = 'ai' AND feedback = 1");
  const thumbsUp = Number(thumbsUpR.rows[0].c);

  const thumbsDownR = await getDb().execute("SELECT COUNT(*) AS c FROM messages WHERE sender = 'ai' AND feedback = -1");
  const thumbsDown = Number(thumbsDownR.rows[0].c);

  const resolvedEscalationsR = await getDb().execute("SELECT COUNT(*) AS c FROM escalations WHERE status = 'resolved'");
  const resolvedEscalations = Number(resolvedEscalationsR.rows[0].c);

  const unansweredR = await getDb().execute(
    `SELECT m.content, e.topic, COUNT(*) AS count
     FROM messages m
     JOIN escalations e ON e.session_id = m.session_id
     WHERE m.feedback = -1 OR e.reason = 'low_confidence'
     GROUP BY m.content, e.topic
     ORDER BY count DESC
     LIMIT 5`
  );
  const unansweredQueries = unansweredR.rows.map((row) => ({
    query: row.content,
    topic: row.topic,
    count: Number(row.count),
  }));

  const escalatedR = await getDb().execute(
    `SELECT e.session_id, m.content, e.reason, e.topic, e.created_at
     FROM escalations e
     JOIN messages m ON m.session_id = e.session_id
     WHERE m.sender = 'user' AND m.id = (
       SELECT MAX(id) FROM messages WHERE session_id = e.session_id AND sender = 'user'
     )
     ORDER BY e.created_at DESC
     LIMIT 10`
  );

  const limit = period === "30d" ? 30 : 7;
  const trendResult = await getDb().execute({
    sql: `SELECT substr(timestamp, 1, 10) AS query_date, COUNT(*) AS c
          FROM messages
          WHERE sender = 'user'
          GROUP BY query_date
          ORDER BY query_date DESC`,
    args: [],
  });
  const rawTrend = Object.fromEntries(trendResult.rows.map((r) => [r.query_date, Number(r.c)]));

  // Build a complete set of dates for the period, filling missing days with 0
  const queryTrend = {};
  for (let i = limit - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    queryTrend[dateStr] = rawTrend[dateStr] || 0;
  }

  return {
    total_sessions: totalSessions,
    total_queries: totalQueries,
    escalated_sessions: escalatedSessions,
    resolved_escalations: resolvedEscalations,
    resolution_rate: Number(resolutionRate.toFixed(2)),
    topics,
    feedback: {
      thumbs_up: thumbsUp,
      thumbs_down: thumbsDown,
    },
    top_escalated_queries: escalatedR.rows,
    unanswered_queries: unansweredQueries,
    query_trend: queryTrend,
  };
}
