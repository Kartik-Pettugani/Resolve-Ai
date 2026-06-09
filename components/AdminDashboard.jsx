"use client";

import { useEffect, useRef, useState } from "react";

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState({
    total_sessions: 0,
    total_queries: 0,
    escalated_sessions: 0,
    resolution_rate: 100,
    topics: {},
    feedback: { thumbs_up: 0, thumbs_down: 0 },
    top_escalated_queries: [],
    query_trend: {}
  });
  const [escalations, setEscalations] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [threshold, setThreshold] = useState(0.4);
  const [url, setUrl] = useState("");
  const [urlName, setUrlName] = useState("");
  const fileRef = useRef(null);

  async function loadAll() {
    try {
      const [m, e, d, c] = await Promise.all([
        fetch("/api/admin/metrics", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/escalations", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/documents", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/admin/config", { cache: "no-store" }).then((r) => r.json())
      ]);
      setMetrics(m);
      setEscalations(e);
      setDocuments(d);
      setThreshold(c.confidence_threshold ?? 0.4);
    } catch (err) {
      console.error("Failed to load dashboard metrics:", err);
    }
  }

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 5000);
    return () => clearInterval(id);
  }, []);

  async function updateThreshold(e) {
    e.preventDefault();
    await fetch("/api/admin/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confidence_threshold: Number(threshold) })
    });
    await loadAll();
  }

  async function resolve(sessionId) {
    await fetch(`/api/admin/escalations/${encodeURIComponent(sessionId)}/resolve`, { method: "POST" });
    await loadAll();
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    await fetch("/api/documents/ingest/file", { method: "POST", body: formData });
    if (fileRef.current) fileRef.current.value = "";
    await loadAll();
  }

  async function ingestUrl(e) {
    e.preventDefault();
    if (!url.trim()) return;
    await fetch("/api/documents/ingest/url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, name: urlName || undefined })
    });
    setUrl("");
    setUrlName("");
    await loadAll();
  }

  async function removeDocument(id) {
    await fetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadAll();
  }

  return (
    <section className="admin-grid">
      <article className="glass card">
        <h3>Analytics Snapshot</h3>
        <div className="metric-grid">
          <div><strong>{metrics.total_sessions}</strong><span>Sessions</span></div>
          <div><strong>{metrics.total_queries}</strong><span>User Queries</span></div>
          <div><strong>{metrics.escalated_sessions}</strong><span>Escalations</span></div>
          <div><strong>{metrics.resolution_rate}%</strong><span>Resolution Rate</span></div>
        </div>
      </article>

      <article className="glass card">
        <h3>Confidence Threshold</h3>
        <form onSubmit={updateThreshold} className="inline-form">
          <input
            type="number"
            min="0"
            max="1"
            step="0.01"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
          />
          <button type="submit">Save</button>
        </form>
      </article>

      <article className="glass card wide">
        <h3>Escalation Queue</h3>
        <div className="list">
          {escalations.length === 0 && <p>No escalations yet.</p>}
          {escalations.map((e) => (
            <div key={e.id} className="list-item">
              <div>
                <strong>{e.topic}</strong>
                <p>{e.reason} • {e.session_id}</p>
                <small style={{ display: "block", marginTop: "5px", color: "var(--muted)" }}>{e.summary}</small>
              </div>
              {e.status !== "resolved" ? <button onClick={() => resolve(e.session_id)}>Resolve</button> : <span>Resolved</span>}
            </div>
          ))}
        </div>
      </article>

      <article className="glass card wide">
        <h3>Knowledge Base Management</h3>
        <div className="kb-actions">
          <label className="upload-label">
            Upload PDF/Markdown
            <input ref={fileRef} type="file" onChange={uploadFile} accept=".pdf,.md,.markdown,.txt" />
          </label>
          <form onSubmit={ingestUrl} className="url-form">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.example.com/article" />
            <input value={urlName} onChange={(e) => setUrlName(e.target.value)} placeholder="Optional label" />
            <button type="submit">Ingest URL</button>
          </form>
        </div>
        <div className="list">
          {documents.map((doc) => (
            <div key={doc.id} className="list-item">
              <div>
                <strong>{doc.name}</strong>
                <p>{doc.type} · ID: {doc.id.slice(0, 16)}... {doc.chunk_count !== undefined ? `(${doc.chunk_count} chunks)` : ""}</p>
              </div>
              <button onClick={() => removeDocument(doc.id)}>Delete</button>
            </div>
          ))}
        </div>
      </article>

      <article className="glass card wide">
        <h3>Top Unanswered Patterns</h3>
        <div className="list">
          {(metrics.top_escalated_queries || []).map((q, idx) => (
            <div key={`${q.created_at}_${idx}`} className="list-item">
              <div>
                <strong>{q.topic}</strong>
                <p>{q.content}</p>
              </div>
              <span>{q.reason}</span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
