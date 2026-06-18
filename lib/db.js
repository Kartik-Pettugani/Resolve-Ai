import { createClient } from "@libsql/client";
import { upsertChunksToQdrant, deleteChunksFromQdrant } from "./qdrant.js";

const db = createClient({
  url: process.env.TURSO_DATABASE_URL || "file:./data/support_agent.db",
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

let dbInitialized = false;
let dbInitPromise = null;

export async function initDb() {
  if (dbInitialized) return;
  if (dbInitPromise) return dbInitPromise;

  dbInitPromise = (async () => {
    await db.executeMultiple(`
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

    const existing = await db.execute({
      sql: "SELECT value FROM settings WHERE key = ?",
      args: ["confidence_threshold"],
    });
    if (!existing.rows.length) {
      await db.execute({
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
  const result = await db.execute({
    sql: "SELECT value FROM settings WHERE key = ?",
    args: ["confidence_threshold"],
  });
  return result.rows.length ? Number(result.rows[0].value) : 0.4;
}

export async function setConfidenceThreshold(value) {
  await ensureDb();
  await db.execute({
    sql: "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    args: ["confidence_threshold", String(value)],
  });
  return getConfidenceThreshold();
}

export async function addDocument({ id, name, type, content }) {
  await ensureDb();
  await db.execute({
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
  await db.batch(statements);
  await upsertChunksToQdrant(chunks);
}

export async function getAllChunks() {
  await ensureDb();
  const result = await db.execute("SELECT id, document_id, chunk_index, content, embedding FROM document_chunks");
  return result.rows.map((r) => {
    try {
      return { ...r, embedding: JSON.parse(r.embedding) };
    } catch {
      return { ...r, embedding: [] };
    }
  });
}

export async function getAllDocuments() {
  await ensureDb();
  const result = await db.execute("SELECT id, name, type, created_at FROM documents ORDER BY created_at DESC");
  return result.rows;
}

export async function deleteDocument(docId) {
  await ensureDb();
  await db.execute({
    sql: "DELETE FROM document_chunks WHERE document_id = ?",
    args: [docId],
  });
  await db.execute({
    sql: "DELETE FROM documents WHERE id = ?",
    args: [docId],
  });
  await deleteChunksFromQdrant(docId);
}

export async function getOrCreateSession(sessionId) {
  await ensureDb();
  const found = await db.execute({
    sql: "SELECT id, status, created_at, updated_at FROM sessions WHERE id = ?",
    args: [sessionId],
  });
  if (found.rows.length) return found.rows[0];
  const ts = nowIso();
  await db.execute({
    sql: "INSERT INTO sessions (id, status, created_at, updated_at) VALUES (?, 'ai', ?, ?)",
    args: [sessionId, ts, ts],
  });
  const result = await db.execute({
    sql: "SELECT id, status, created_at, updated_at FROM sessions WHERE id = ?",
    args: [sessionId],
  });
  return result.rows[0];
}

export async function updateSessionStatus(sessionId, status) {
  await ensureDb();
  await db.execute({
    sql: "UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?",
    args: [status, nowIso(), sessionId],
  });
}

export async function addMessage(sessionId, sender, content) {
  await ensureDb();
  await getOrCreateSession(sessionId);
  const ts = nowIso();
  const result = await db.execute({
    sql: "INSERT INTO messages (session_id, sender, content, timestamp) VALUES (?, ?, ?, ?)",
    args: [sessionId, sender, content, ts],
  });
  await db.execute({
    sql: "UPDATE sessions SET updated_at = ? WHERE id = ?",
    args: [ts, sessionId],
  });
  return Number(result.lastInsertRowid);
}

export async function getSessionMessages(sessionId) {
  await ensureDb();
  const result = await db.execute({
    sql: "SELECT id, sender, content, timestamp, feedback FROM messages WHERE session_id = ? ORDER BY id ASC",
    args: [sessionId],
  });
  return result.rows;
}

export async function updateMessageFeedback(messageId, feedback) {
  await ensureDb();
  await db.execute({
    sql: "UPDATE messages SET feedback = ? WHERE id = ?",
    args: [feedback, messageId],
  });
  const result = await db.execute({
    sql: "SELECT id, session_id, sender, content, feedback FROM messages WHERE id = ?",
    args: [messageId],
  });
  return result.rows[0] || null;
}

export async function createEscalation(sessionId, reason, summary, topic) {
  await ensureDb();
  await updateSessionStatus(sessionId, "human");
  await db.execute({
    sql: "INSERT INTO escalations (session_id, reason, summary, topic, created_at, status) VALUES (?, ?, ?, ?, ?, 'pending') ON CONFLICT(session_id) DO UPDATE SET reason=excluded.reason, summary=excluded.summary, topic=excluded.topic, created_at=excluded.created_at, status='pending'",
    args: [sessionId, reason, summary, topic, nowIso()],
  });
}

export async function getAllEscalations() {
  await ensureDb();
  const result = await db.execute(
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
  await db.execute({
    sql: "UPDATE escalations SET status = 'resolved' WHERE session_id = ?",
    args: [sessionId],
  });
}

export async function getAnalyticsMetrics() {
  await ensureDb();

  const totalSessionsR = await db.execute("SELECT COUNT(*) AS c FROM sessions");
  const totalSessions = Number(totalSessionsR.rows[0].c);

  const totalQueriesR = await db.execute("SELECT COUNT(*) AS c FROM messages WHERE sender = 'user'");
  const totalQueries = Number(totalQueriesR.rows[0].c);

  const escalatedSessionsR = await db.execute("SELECT COUNT(*) AS c FROM escalations");
  const escalatedSessions = Number(escalatedSessionsR.rows[0].c);

  const resolutionRate = totalSessions > 0 ? ((totalSessions - escalatedSessions) / totalSessions) * 100 : 100;

  const topicsResult = await db.execute("SELECT topic, COUNT(*) AS c FROM escalations GROUP BY topic ORDER BY c DESC");
  const topics = Object.fromEntries(topicsResult.rows.map((r) => [r.topic, Number(r.c)]));

  const thumbsUpR = await db.execute("SELECT COUNT(*) AS c FROM messages WHERE sender = 'ai' AND feedback = 1");
  const thumbsUp = Number(thumbsUpR.rows[0].c);

  const thumbsDownR = await db.execute("SELECT COUNT(*) AS c FROM messages WHERE sender = 'ai' AND feedback = -1");
  const thumbsDown = Number(thumbsDownR.rows[0].c);

  const escalatedR = await db.execute(
    `SELECT e.session_id, m.content, e.reason, e.topic, e.created_at
     FROM escalations e
     JOIN messages m ON m.session_id = e.session_id
     WHERE m.sender = 'user' AND m.id = (
       SELECT MAX(id) FROM messages WHERE session_id = e.session_id AND sender = 'user'
     )
     ORDER BY e.created_at DESC
     LIMIT 10`
  );

  const trendResult = await db.execute(
    `SELECT substr(timestamp, 1, 10) AS query_date, COUNT(*) AS c
     FROM messages
     WHERE sender = 'user'
     GROUP BY query_date
     ORDER BY query_date DESC
     LIMIT 7`
  );
  const queryTrend = Object.fromEntries(trendResult.rows.map((r) => [r.query_date, Number(r.c)]));

  return {
    total_sessions: totalSessions,
    total_queries: totalQueries,
    escalated_sessions: escalatedSessions,
    resolution_rate: Number(resolutionRate.toFixed(2)),
    topics,
    feedback: {
      thumbs_up: thumbsUp,
      thumbs_down: thumbsDown,
    },
    top_escalated_queries: escalatedR.rows,
    query_trend: queryTrend,
  };
}
