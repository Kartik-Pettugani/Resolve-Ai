"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, ThumbsUp, ThumbsDown, Sparkles, User,
  Zap, CheckCircle, AlertCircle, Info,
  FileText, DollarSign, Package, Settings,
  ChevronRight, Bot, LogOut, Plus, Loader2,
} from "lucide-react";
import Link from "next/link";
import Logo from "@/components/Logo";
import ReactMarkdown from "react-markdown";

const MAX_CHARS = 2000;

const STARTERS = [
  { icon: FileText,    text: "Refund Policy" },
  { icon: DollarSign,  text: "Pricing" },
  { icon: Package,     text: "Shipping" },
  { icon: Settings,    text: "Account Settings" },
];

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return ""; }
}

function senderLabel(s) {
  if (s === "ai")     return "Resolve AI";
  if (s === "human")  return "Human Agent";
  if (s === "system") return "System";
  return "You";
}

/* ─── Toast ─────────────────────────────────────── */
const TOAST_ICONS = {
  success: <CheckCircle size={14} />,
  danger:  <AlertCircle size={14} />,
  info:    <Info size={14} />,
};

function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className={`toast toast-${t.type}`}
            initial={{ opacity: 0, x: 60, scale: .9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: .9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          >
            <span style={{ color: t.type === "success" ? "var(--green)" : t.type === "danger" ? "var(--red)" : "var(--indigo)", flexShrink: 0 }}>
              {TOAST_ICONS[t.type] ?? TOAST_ICONS.info}
            </span>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ─── Message variants ───────────────────────────── */
const msgVariants = {
  hidden: { opacity: 0, y: 12, scale: .97 },
  show:   { opacity: 1, y: 0,  scale: 1, transition: { type: "spring", stiffness: 380, damping: 28 } },
};

const listVariants = { hidden: {}, show: { transition: { staggerChildren: .04 } } };

/* ════════════════════════════════════════════════ */
export default function ChatInterface({ sessionId }) {
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [sending,  setSending]  = useState(false);
  const [status,   setStatus]   = useState("ai");
  const [toasts,   setToasts]   = useState([]);
  const listRef     = useRef(null);
  const textareaRef = useRef(null);

  const addToast = useCallback((msg, type = "info") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      const res = await fetch("/api/logout", { method: "POST" });
      if (res.ok) window.location.reload();
    } catch {}
  }, []);

  const handleNewConversation = useCallback(() => {
    localStorage.removeItem("resolve_session_id");
    window.location.reload();
  }, []);

  const scrollBottom = useCallback(() => {
    if (listRef.current)
      listRef.current.scrollTop = listRef.current.scrollHeight;
  }, []);

  const loadHistory = useCallback(async () => {
    if (!sessionId) return;
    try {
      const res = await fetch(`/api/chat/history?session_id=${encodeURIComponent(sessionId)}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setMessages(data.messages || []);
      setStatus(data.status || "ai");
    } catch {}
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    loadHistory();
    const id = setInterval(loadHistory, 4000);
    return () => clearInterval(id);
  }, [sessionId, loadHistory]);

  useEffect(() => { scrollBottom(); }, [messages, sending, scrollBottom]);
  useEffect(() => { if (!sending) textareaRef.current?.focus(); }, [sending]);

  async function sendMessage(text) {
    const trimmed = (text || input).trim();
    if (!trimmed || sending) return;
    setSending(true);
    setInput("");
    setMessages((p) => [
      ...p,
      { id: `tmp_${Date.now()}`, sender: "user", content: trimmed, timestamp: new Date().toISOString(), feedback: 0 },
    ]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: trimmed }),
      });
      if (res.ok) await loadHistory();
      else addToast("Failed to send message", "danger");
    } catch { addToast("Network error", "danger"); }
    finally { setSending(false); textareaRef.current?.focus(); }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  async function submitFeedback(messageId, feedback) {
    try {
      await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message_id: messageId, feedback }),
      });
      setMessages((p) => p.map((m) => m.id === messageId ? { ...m, feedback } : m));
      if (feedback === 1)  addToast("Thanks — marked as helpful!", "success");
      if (feedback === -1) addToast("Escalating to a human agent.", "info");
    } catch {}
  }

  const isHuman  = status === "human";
  const hasMessages = messages.length > 0 || sending;

  /* ─── Top navigation JSX (inlined — never a component) ── */
  const topNav = (
    <div className="chat-topnav">
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 28, height: 28, borderRadius: 7, overflow: "hidden", flexShrink: 0 }}>
          <Logo size={28} />
        </div>
        <span style={{
          fontFamily: "Geist, sans-serif",
          fontWeight: 700,
          fontSize: ".9375rem",
          letterSpacing: "-.025em",
          background: "linear-gradient(135deg,#b0c6ff,#d0bcff)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Resolve AI
        </span>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: ".4375rem",
          letterSpacing: ".1em",
          textTransform: "uppercase",
          color: "var(--text-3)",
          background: "var(--surface-3)",
          border: "1px solid var(--border-2)",
          borderRadius: 99,
          padding: "2px 8px",
        }}>
          Support
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button 
          onClick={handleNewConversation}
          className="admin-console-link"
        >
          <Plus size={12} /> <span>New Chat</span>
        </button>
        <Link href="/admin" className="admin-console-link">
          <Settings size={12} /> <span>Admin Console</span>
        </Link>
        <button 
          onClick={handleLogout}
          className="admin-console-link danger"
        >
          <LogOut size={12} /> <span>Log Out</span>
        </button>
      </div>
    </div>
  );

  /* ─── Composer input JSX (inlined — never a component) ── */
  const composerBar = (
    <div className="chat-input-zone">
      <form
        className="composer-v2"
        onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
      >
        <textarea
          ref={textareaRef}
          className="composer-v2-input"
          value={input}
          onChange={(e) => {
            if (e.target.value.length <= MAX_CHARS) setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={isHuman ? "Human agent connected — type a message…" : "Message Resolve AI..."}
          disabled={sending}
          style={{ overflow: "hidden" }}
          onInput={(e) => {
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
          }}
        />
        <motion.button
          type="submit"
          className="composer-v2-send"
          disabled={sending || !input.trim()}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: .92 }}
          aria-label="Send"
        >
          {sending ? <Loader2 size={16} className="spinner" /> : <ChevronRight size={16} />}
        </motion.button>
      </form>
      <div className="composer-v2-footer">
        <span className="engine-label">
          <Zap size={8} /> Resolve-v2 Engine
        </span>
        <span className="char-count-label">{input.length}/{MAX_CHARS}</span>
      </div>
      <p className="disclaimer-v2">
        AI may display inaccurate info. Always check important facts.
      </p>
    </div>
  );

  /* ─── Welcome / empty state ───────────────────── */
  if (!hasMessages) {
    return (
      <>
        {topNav}
        <div className="chat-welcome-wrap">
          <div className="chat-welcome-inner">
            <motion.div
              className="welcome-logo-box"
              initial={{ opacity: 0, scale: .9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 280, damping: 22 }}
            >
              <Logo size={72} />
            </motion.div>

            <motion.div
              className="welcome-spark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: .1 }}
            >
              <Zap size={16} />
            </motion.div>

            <motion.h1
              className="welcome-h1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: .14, type: "spring", stiffness: 280, damping: 24 }}
            >
              Welcome to Resolve
            </motion.h1>

            <motion.p
              className="welcome-sub"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: .2 }}
            >
              I&apos;m your AI support assistant. How can I help you streamline your tasks today?
            </motion.p>

            <motion.div
              className="starters-row"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: .28 }}
            >
              <div className="starters-divider-line" />
              <span className="starters-label-text">Starter Prompts</span>
              <div className="starters-divider-line" />
            </motion.div>

            <motion.div
              className="starters-grid-v2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: .32 }}
            >
              {STARTERS.map(({ icon: Icon, text }, i) => (
                <motion.button
                  key={text}
                  className="starter-chip-v2"
                  onClick={() => sendMessage(text)}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: .97 }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: .34 + i * .06 }}
                >
                  <span className="chip-icon-box">
                    <Icon size={13} />
                  </span>
                  {text}
                </motion.button>
              ))}
            </motion.div>
          </div>

          {composerBar}
        </div>

        <Toasts toasts={toasts} />
      </>
    );
  }

  /* ─── Active chat ─────────────────────────────── */
  return (
    <>
      {topNav}

      <div className="chat-active-wrap">
        <div className="chat-active-inner">
          {/* Agent strip */}
          <div className="chat-agent-strip">
            <motion.div
              style={{
                width: 34, height: 34,
                borderRadius: "50%",
                background: isHuman ? "linear-gradient(135deg,#5417be,#d0bcff)" : "linear-gradient(135deg,#5417be,#a78bfa)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", flexShrink: 0,
              }}
              animate={{ boxShadow: isHuman
                ? ["0 0 0 0 rgba(167,139,250,.3)", "0 0 16px 4px rgba(167,139,250,.12)", "0 0 0 0 rgba(167,139,250,.3)"]
                : ["0 0 0 0 rgba(99,102,241,.3)", "0 0 16px 4px rgba(99,102,241,.12)", "0 0 0 0 rgba(99,102,241,.3)"] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {isHuman ? <User size={15} /> : <Sparkles size={15} />}
            </motion.div>
            <div>
              <div style={{ fontFamily: "Geist, sans-serif", fontSize: ".9375rem", fontWeight: 600, letterSpacing: "-.02em", color: "var(--text)" }}>
                {isHuman ? "Human Agent" : "Resolve AI"}
              </div>
              <div style={{ marginTop: 2 }}>
                {isHuman ? (
                  <span className="badge badge-violet">
                    <span className="pulse-dot" style={{ background: "var(--violet)" }} />
                    Human connected
                  </span>
                ) : (
                  <span className="badge badge-green">
                    <span className="pulse-dot" style={{ background: "var(--green)" }} />
                    AI online
                  </span>
                )}
              </div>
            </div>
            <span style={{ marginLeft: "auto", fontSize: ".5rem", color: "var(--text-3)", fontFamily: "monospace" }}>
              {sessionId?.slice(0, 18)}…
            </span>
          </div>

          {/* Messages */}
          <div className="chat-messages-scroll" ref={listRef}>
            <AnimatePresence initial={false}>
              <motion.div variants={listVariants} initial="hidden" animate="show" style={{ display: "contents" }}>
                {messages.map((msg) => (
                  <motion.div
                    key={msg.sender === "user"
                      ? `u-${msg.content.slice(0, 60)}-${(msg.timestamp || "").slice(0, 16)}`
                      : msg.id}
                    className={`msg msg-${msg.sender}`}
                    variants={msgVariants}
                    layout
                  >
                    <div className="msg-bubble">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                    <div className="msg-meta">
                      {msg.sender !== "user" && (
                        <span className="msg-sender">{senderLabel(msg.sender)}</span>
                      )}
                      <span className="msg-time">{fmtTime(msg.timestamp)}</span>
                    </div>
                    {msg.sender === "ai" && (
                      <div className="feedback-row">
                        {msg.feedback === 0 ? (
                          <>
                            <motion.button className="fb-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: .92 }}
                              onClick={() => submitFeedback(msg.id, 1)} title="Helpful">
                              <ThumbsUp size={11} /> Helpful
                            </motion.button>
                            <motion.button className="fb-btn" whileHover={{ scale: 1.1 }} whileTap={{ scale: .92 }}
                              onClick={() => submitFeedback(msg.id, -1)} title="Not helpful">
                              <ThumbsDown size={11} /> Not helpful
                            </motion.button>
                          </>
                        ) : msg.feedback === 1 ? (
                          <motion.span className="fb-btn pos" initial={{ scale: .8 }} animate={{ scale: 1 }}>
                            <ThumbsUp size={11} /> Helpful
                          </motion.span>
                        ) : (
                          <motion.span className="fb-btn neg" initial={{ scale: .8 }} animate={{ scale: 1 }}>
                            <ThumbsDown size={11} /> Needs review
                          </motion.span>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>

              {sending && (
                <motion.div
                  key="typing"
                  className="typing-bubble"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                >
                  <div className="typing-dots"><span /><span /><span /></div>
                  <span className="typing-text">Resolve is thinking…</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Input */}
          <div className="chat-input-sticky">
            <div className="composer-v2" style={{ margin: 0 }}>
              <textarea
                ref={textareaRef}
                className="composer-v2-input"
                value={input}
                onChange={(e) => { if (e.target.value.length <= MAX_CHARS) setInput(e.target.value); }}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={isHuman ? "Human agent connected — type a message…" : "Message Resolve AI..."}
                disabled={sending}
                onInput={(e) => {
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
                }}
              />
              <motion.button
                type="button"
                className="composer-v2-send"
                disabled={sending || !input.trim()}
                onClick={() => sendMessage()}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: .92 }}
              >
                {sending ? <Loader2 size={16} className="spinner" /> : <ChevronRight size={16} />}
              </motion.button>
            </div>
            <div className="composer-v2-footer" style={{ padding: "5px 2px 0" }}>
              <span className="engine-label"><Zap size={8} /> Resolve-v2 Engine</span>
              <span className="char-count-label">{input.length}/{MAX_CHARS}</span>
            </div>
            <p className="disclaimer-v2" style={{ marginTop: "4px" }}>
              AI may display inaccurate info. Always check important facts.
            </p>
          </div>
        </div>
      </div>

      <Toasts toasts={toasts} />
    </>
  );
}
