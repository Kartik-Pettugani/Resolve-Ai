import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { upsertChunksToQdrant, deleteChunksFromQdrant } from "./qdrant.js";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "support_agent.db");
const db = new Database(dbPath);

export function initDb() {
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
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

  const existing = db.prepare("SELECT value FROM settings WHERE key = ?").get("confidence_threshold");
  if (!existing) {
    db.prepare("INSERT INTO settings (key, value) VALUES (?, ?)").run("confidence_threshold", "0.40");
  }
}

initDb();

function nowIso() {
  return new Date().toISOString();
}

export function getConfidenceThreshold() {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get("confidence_threshold");
  return row ? Number(row.value) : 0.4;
}

export function setConfidenceThreshold(value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run("confidence_threshold", String(value));
  return getConfidenceThreshold();
}

export function addDocument({ id, name, type, content }) {
  db.prepare(
    "INSERT OR REPLACE INTO documents (id, name, type, content, created_at) VALUES (?, ?, ?, ?, ?)"
  ).run(id, name, type, content, nowIso());
}

export async function addChunks(chunks) {
  const stmt = db.prepare(
    "INSERT OR REPLACE INTO document_chunks (id, document_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?, ?)"
  );
  const tx = db.transaction((rows) => {
    for (const row of rows) {
      stmt.run(row.id, row.document_id, row.chunk_index, row.content, JSON.stringify(row.embedding));
    }
  });
  tx(chunks);
  await upsertChunksToQdrant(chunks);
}

export function getAllChunks() {
  const rows = db.prepare("SELECT id, document_id, chunk_index, content, embedding FROM document_chunks").all();
  return rows.map((r) => {
    try {
      return { ...r, embedding: JSON.parse(r.embedding) };
    } catch {
      return { ...r, embedding: [] };
    }
  });
}

export function getAllDocuments() {
  return db.prepare("SELECT id, name, type, created_at FROM documents ORDER BY created_at DESC").all();
}

export async function deleteDocument(docId) {
  db.prepare("DELETE FROM documents WHERE id = ?").run(docId);
  await deleteChunksFromQdrant(docId);
}

export function getOrCreateSession(sessionId) {
  const found = db.prepare("SELECT id, status, created_at, updated_at FROM sessions WHERE id = ?").get(sessionId);
  if (found) return found;
  const ts = nowIso();
  db.prepare("INSERT INTO sessions (id, status, created_at, updated_at) VALUES (?, 'ai', ?, ?)").run(sessionId, ts, ts);
  return db.prepare("SELECT id, status, created_at, updated_at FROM sessions WHERE id = ?").get(sessionId);
}

export function updateSessionStatus(sessionId, status) {
  db.prepare("UPDATE sessions SET status = ?, updated_at = ? WHERE id = ?").run(status, nowIso(), sessionId);
}

export function addMessage(sessionId, sender, content) {
  getOrCreateSession(sessionId);
  const ts = nowIso();
  const result = db.prepare("INSERT INTO messages (session_id, sender, content, timestamp) VALUES (?, ?, ?, ?)").run(sessionId, sender, content, ts);
  db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(ts, sessionId);
  return Number(result.lastInsertRowid);
}

export function getSessionMessages(sessionId) {
  return db
    .prepare("SELECT id, sender, content, timestamp, feedback FROM messages WHERE session_id = ? ORDER BY id ASC")
    .all(sessionId);
}

export function updateMessageFeedback(messageId, feedback) {
  db.prepare("UPDATE messages SET feedback = ? WHERE id = ?").run(feedback, messageId);
  return db.prepare("SELECT id, session_id, sender, content, feedback FROM messages WHERE id = ?").get(messageId);
}

export function createEscalation(sessionId, reason, summary, topic) {
  updateSessionStatus(sessionId, "human");
  db.prepare(
    "INSERT INTO escalations (session_id, reason, summary, topic, created_at, status) VALUES (?, ?, ?, ?, ?, 'pending') ON CONFLICT(session_id) DO UPDATE SET reason=excluded.reason, summary=excluded.summary, topic=excluded.topic, created_at=excluded.created_at, status='pending'"
  ).run(sessionId, reason, summary, topic, nowIso());
}

export function getAllEscalations() {
  return db
    .prepare(
      `SELECT e.id, e.session_id, e.reason, e.summary, e.topic, e.created_at, e.status, s.status AS session_status
       FROM escalations e
       JOIN sessions s ON s.id = e.session_id
       ORDER BY e.created_at DESC`
    )
    .all();
}

export function resolveEscalation(sessionId) {
  updateSessionStatus(sessionId, "ai");
  db.prepare("UPDATE escalations SET status = 'resolved' WHERE session_id = ?").run(sessionId);
}

export function getAnalyticsMetrics() {
  const totalSessions = db.prepare("SELECT COUNT(*) AS c FROM sessions").get().c;
  const totalQueries = db.prepare("SELECT COUNT(*) AS c FROM messages WHERE sender = 'user'").get().c;
  const escalatedSessions = db.prepare("SELECT COUNT(*) AS c FROM escalations").get().c;
  const resolutionRate = totalSessions > 0 ? ((totalSessions - escalatedSessions) / totalSessions) * 100 : 100;

  const topicsRows = db
    .prepare("SELECT topic, COUNT(*) AS c FROM escalations GROUP BY topic ORDER BY c DESC")
    .all();
  const topics = Object.fromEntries(topicsRows.map((r) => [r.topic, r.c]));

  const thumbsUp = db.prepare("SELECT COUNT(*) AS c FROM messages WHERE sender = 'ai' AND feedback = 1").get().c;
  const thumbsDown = db.prepare("SELECT COUNT(*) AS c FROM messages WHERE sender = 'ai' AND feedback = -1").get().c;

  const escalated = db
    .prepare(
      `SELECT e.session_id, m.content, e.reason, e.topic, e.created_at
       FROM escalations e
       JOIN messages m ON m.session_id = e.session_id
       WHERE m.sender = 'user' AND m.id = (
         SELECT MAX(id) FROM messages WHERE session_id = e.session_id AND sender = 'user'
       )
       ORDER BY e.created_at DESC
       LIMIT 10`
    )
    .all();

  const trendRows = db
    .prepare(
      `SELECT substr(timestamp, 1, 10) AS query_date, COUNT(*) AS c
       FROM messages
       WHERE sender = 'user'
       GROUP BY query_date
       ORDER BY query_date DESC
       LIMIT 7`
    )
    .all();
  const queryTrend = Object.fromEntries(trendRows.map((r) => [r.query_date, r.c]));

  return {
    total_sessions: totalSessions,
    total_queries: totalQueries,
    escalated_sessions: escalatedSessions,
    resolution_rate: Number(resolutionRate.toFixed(2)),
    topics,
    feedback: {
      thumbs_up: thumbsUp,
      thumbs_down: thumbsDown
    },
    top_escalated_queries: escalated,
    query_trend: queryTrend
  };
}
