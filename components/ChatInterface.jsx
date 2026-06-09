"use client";

import { useEffect, useMemo, useRef, useState } from "react";

export default function ChatInterface({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("ai");
  const listRef = useRef(null);
  const composerRef = useRef(null);

  const stateText = useMemo(() => (status === "human" ? "Connected to Human Agent" : "AI Responding"), [status]);

  const messageLabel = (sender) => {
    if (sender === "ai") return "Resolve Assistant";
    if (sender === "human") return "Human Agent";
    if (sender === "system") return "System";
    return "You";
  };

  const messageTone = (sender) => {
    if (sender === "ai") return "ai";
    if (sender === "human") return "human";
    if (sender === "system") return "system";
    return "user";
  };

  const focusComposer = () => {
    composerRef.current?.focus();
  };

  async function loadHistory() {
    const res = await fetch(`/api/chat/history?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
    if (!res.ok) return;
    const data = await res.json();
    setMessages(data.messages || []);
    setStatus(data.status || "ai");
  }

  useEffect(() => {
    if (!sessionId) return;
    loadHistory();
    const id = setInterval(loadHistory, 4000);
    return () => clearInterval(id);
  }, [sessionId]);

  useEffect(() => {
    if (!sending) {
      focusComposer();
    }
  }, [sending]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, sending]);

  async function sendMessage(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setInput("");

    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        sender: "user",
        content: text,
        timestamp: new Date().toISOString(),
        feedback: 0
      }
    ]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text })
      });
      if (res.ok) {
        await loadHistory();
      }
    } finally {
      setSending(false);
      focusComposer();
    }
  }

  async function handleComposerKeyDown(e) {
    if (e.key !== "Enter") return;
    if (e.shiftKey) return;
    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      await sendMessage(e);
      return;
    }
    e.preventDefault();
    await sendMessage(e);
  }

  async function submitFeedback(messageId, feedback) {
    await fetch("/api/chat/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message_id: messageId, feedback })
    });
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, feedback } : m)));
  }

  return (
    <section className="chat glass">
      <div className="chat-header">
        <div>
          <h2>Resolve Support Chat</h2>
        </div>
        <span className={`state-pill ${status === "human" ? "human" : "ai"}`}>{stateText}</span>
      </div>

      <div className="messages" ref={listRef}>
        {messages.map((msg) => (
          <article key={msg.id} className={`message ${messageTone(msg.sender)}`}>
            <header className="message-head">
              <div className="message-badge-wrap">
                <span className={`message-badge ${messageTone(msg.sender)}`}>{messageLabel(msg.sender)}</span>
                {msg.sender === "ai" && msg.feedback !== 0 && (
                  <span className={`feedback-chip ${msg.feedback === 1 ? "positive" : "negative"}`}>
                    {msg.feedback === 1 ? "Helpful" : "Needs review"}
                  </span>
                )}
              </div>
              <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
            </header>
            <p>{msg.content}</p>
            <footer>
              {msg.sender === "ai" && (
                <div className="feedback-row">
                  <button
                    type="button"
                    aria-label="Mark response as helpful"
                    disabled={msg.feedback !== 0}
                    onClick={() => submitFeedback(msg.id, 1)}
                    className={msg.feedback === 1 ? "active" : ""}
                  >
                    👍
                  </button>
                  <button
                    type="button"
                    aria-label="Mark response as unhelpful"
                    disabled={msg.feedback !== 0}
                    onClick={() => submitFeedback(msg.id, -1)}
                    className={msg.feedback === -1 ? "active" : ""}
                  >
                    👎
                  </button>
                </div>
              )}
            </footer>
          </article>
        ))}
        {sending && (
          <article className="message ai typing-card" aria-live="polite">
            <header className="message-head">
              <div className="message-badge-wrap">
                <span className="message-badge ai">Resolve Assistant</span>
                <span className="typing-label">Generating</span>
              </div>
            </header>
            <div className="typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </div>
          </article>
        )}
      </div>

      <form className="composer" onSubmit={sendMessage}>
        <textarea
          ref={composerRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleComposerKeyDown}
          rows={2}
          placeholder={status === "human" ? "Human agent is connected..." : "Type your support question..."}
        />
        <div className="composer-actions">
          <p>Enter to send · Shift+Enter for a new line</p>
          <button type="submit" disabled={sending || !input.trim()}>Send</button>
        </div>
      </form>
    </section>
  );
}
