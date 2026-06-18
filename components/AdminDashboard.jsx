"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView, useMotionValue, useSpring } from "framer-motion";
import {
  LayoutDashboard, MessageSquare, Users, BookOpen,
  BarChart2, Settings, Zap, TrendingUp, TrendingDown,
  CheckCircle, Trash2, Globe, FileText, FileCode,
  Upload, ThumbsUp, ThumbsDown, Info, AlertCircle,
  AlertTriangle, Filter, Sparkles,
  Clock, Activity, Menu, X, UserCircle2, LogOut,
} from "lucide-react";
import LogoComponent from "@/components/Logo";

/* ══════════════════════════════════════════════
   MOTION VARIANTS
══════════════════════════════════════════════ */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 26 } },
};
const staggerGrid = {
  hidden: {},
  show:   { transition: { staggerChildren: .07 } },
};

/* ══════════════════════════════════════════════
   ANIMATED COUNTER
══════════════════════════════════════════════ */
function AnimCounter({ value, suffix = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { stiffness: 60, damping: 18 });
  const [display, setDisplay] = useState("0");

  useEffect(() => {
    if (inView && value !== "—") {
      const num = parseFloat(String(value).replace(/[^0-9.]/g, ""));
      if (!isNaN(num)) mv.set(num);
    }
  }, [inView, value, mv]);

  useEffect(() => {
    const unsub = spring.on("change", (v) => {
      const num = parseFloat(String(value).replace(/[^0-9.]/g, ""));
      if (isNaN(num)) { setDisplay(String(value)); return; }
      const str = Number.isInteger(num) ? Math.round(v).toString() : v.toFixed(1);
      setDisplay(str + suffix);
    });
    return unsub;
  }, [spring, value, suffix]);

  if (value === "—") return <span ref={ref}>—</span>;
  return <span ref={ref}>{display}</span>;
}

/* ══════════════════════════════════════════════
   SPARKLINE
══════════════════════════════════════════════ */
function Sparkline({ path, color = "#b0c6ff" }) {
  return (
    <svg width={96} height={30} viewBox="0 0 100 30" fill="none">
      <path d={path} stroke={color} strokeWidth={2} strokeLinecap="round" fill="none"
        style={{ strokeDasharray: 200, strokeDashoffset: 200, animation: "sparkDash 2s ease forwards" }} />
      <style>{`@keyframes sparkDash { to { stroke-dashoffset: 0; } }`}</style>
    </svg>
  );
}

/* ══════════════════════════════════════════════
   BAR CHART
══════════════════════════════════════════════ */
const DAY_KEYS  = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MOCK_BARS = [67, 83, 50, 94, 78, 61, 89]; // default visual heights %

function getBarLabel(dateStr, is30d) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (is30d) {
      return d.toLocaleDateString([], { day: "numeric" });
    } else {
      return d.toLocaleDateString([], { weekday: "short" }).toUpperCase();
    }
  } catch {
    return dateStr;
  }
}

function BarChart({ data, is30d }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true });
  const limit = is30d ? 30 : 7;
  const entries = data ? Object.entries(data).sort(([a], [b]) => a.localeCompare(b)).slice(-limit) : [];
  const max = entries.length ? Math.max(...entries.map(([, v]) => v), 1) : 1;

  const barCount = entries.length || limit;
  const bars = [];
  for (let i = 0; i < barCount; i++) {
    if (entries[i]) {
      const [dateStr, val] = entries[i];
      bars.push({
        key: dateStr,
        label: getBarLabel(dateStr, is30d),
        count: val,
        pct: Math.max(5, (val / max) * 100),
        tooltip: `${dateStr}: ${val} queries`
      });
    } else {
      const mockVal = is30d ? Math.floor(20 + Math.random() * 60) : MOCK_BARS[i];
      bars.push({
        key: `mock-${i}`,
        label: is30d ? String(i + 1) : DAY_KEYS[i],
        count: mockVal,
        pct: mockVal,
        tooltip: is30d ? `Mock day ${i+1}` : DAY_KEYS[i]
      });
    }
  }

  return (
    <div className="bar-chart-wrap" style={{ gap: is30d ? "4px" : "12px" }} ref={ref}>
      {bars.map((bar, i) => (
        <div key={bar.key} className="bar-col">
          <div className="bar-track">
            <motion.div
              className="bar-fill"
              initial={{ height: "5%" }}
              animate={inView ? { height: `${bar.pct}%` } : { height: "5%" }}
              transition={{ delay: i * (is30d ? 0.02 : 0.05), type: "spring", stiffness: 200, damping: 22 }}
              title={bar.tooltip}
            />
          </div>
          <span className="bar-lbl">{bar.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════
   DONUT CHART (Sentiment Pulse)
══════════════════════════════════════════════ */
function DonutChart({ thumbsUp = 0, thumbsDown = 0 }) {
  const total = (thumbsUp + thumbsDown) || 1;
  const positivePct = Math.round((thumbsUp / total) * 100);
  const r    = 80;
  const sw   = 12;
  const circ = 2 * Math.PI * r;

  const blueOffset   = circ * (1 - thumbsUp   / total);
  const purpleOffset = circ * (1 - thumbsDown / total);

  return (
    <div className="donut-wrap" style={{ width: 192, height: 192 }}>
      <svg width={192} height={192} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={96} cy={96} r={r} fill="none" stroke="#333" strokeWidth={sw} />
        <circle cx={96} cy={96} r={r} fill="none" stroke="#b0c6ff" strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={blueOffset}
          style={{ transition: "stroke-dashoffset 1s ease" }} />
        <circle cx={96} cy={96} r={r} fill="none" stroke="#5417be" strokeWidth={sw}
          strokeDasharray={circ} strokeDashoffset={purpleOffset}
          style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className="donut-center">
        <span className="donut-pct">{thumbsUp + thumbsDown ? positivePct : "—"}%</span>
        <span className="donut-lbl">Positive</span>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════
   TOAST
══════════════════════════════════════════════ */
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
          <motion.div key={t.id} className={`toast toast-${t.type}`}
            initial={{ opacity: 0, x: 60, scale: .9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: .9 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}>
            <span style={{ color: t.type === "success" ? "var(--green)" : t.type === "danger" ? "var(--red)" : "var(--indigo)", flexShrink: 0 }}>
              {TOAST_ICONS[t.type]}
            </span>
            {t.msg}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ══════════════════════════════════════════════
   HELPERS
══════════════════════════════════════════════ */
function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}
function timeAgo(iso) {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return "—"; }
}
function fmtNum(n) {
  if (!n && n !== 0) return "—";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}
function getPriority(reason) {
  if (reason === "low_confidence" || reason === "negative_feedback") return "HIGH";
  if (reason === "out_of_scope"   || reason === "human_mode")        return "MEDIUM";
  return "LOW";
}
function getSentiment(reason) {
  if (reason === "negative_feedback") return "Negative";
  if (reason === "low_confidence")    return "Neutral";
  return "Neutral";
}
function fmtSessionId(sid) {
  const c = sid.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return `#RS-${(c.slice(0, 4) || "0001")}-${c.slice(4, 5) || "A"}`;
}
function reasonLabel(r) {
  if (r === "low_confidence")    return "Low Confidence";
  if (r === "out_of_scope")      return "Out of Scope";
  if (r === "negative_feedback") return "Neg. Feedback";
  return r || "Unknown";
}
function docIcon(type) {
  if (type === "pdf") return { cls: "doc-icon-pdf", el: <FileText  size={16} /> };
  if (type === "md")  return { cls: "doc-icon-md",  el: <FileCode  size={16} /> };
  if (type === "url") return { cls: "doc-icon-url", el: <Globe     size={16} /> };
  return                     { cls: "doc-icon-txt", el: <FileText  size={16} /> };
}

/* ══════════════════════════════════════════════
   TABLE AVATAR COLORS
══════════════════════════════════════════════ */
const AVATAR_COLORS = [
  { bg: "rgba(76,214,255,.15)",  color: "#4cd6ff" },
  { bg: "rgba(208,188,255,.15)", color: "#d0bcff" },
  { bg: "rgba(176,198,255,.15)", color: "#b0c6ff" },
  { bg: "rgba(52,211,153,.15)",  color: "#34d399" },
];

/* ══════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════ */
export default function AdminDashboard() {
  const [tab,           setTab]           = useState("overview");
  const [hdrTab,        setHdrTab]        = useState("analytics");
  const [chartPeriod,   setChartPeriod]   = useState("7d");
  const [expandedSession, setExpandedSession] = useState(null);
  const [escalView,     setEscalView]     = useState("active");
  const [metrics,       setMetrics]       = useState(null);
  const [escalations,   setEscalations]   = useState([]);
  const [documents,     setDocuments]     = useState([]);
  const [threshold,     setThreshold]     = useState(0.4);
  const [pendingThresh, setPendingThresh] = useState(null);
  const [urlInput,      setUrlInput]      = useState("");
  const [urlName,       setUrlName]       = useState("");
  const [uploading,     setUploading]     = useState(false);
  const [ingesting,     setIngesting]     = useState(false);
  const [toasts,        setToasts]        = useState([]);
  const [replies,       setReplies]       = useState({});
  const [sendingReply,  setSendingReply]  = useState({});
  const [mobileSb,      setMobileSb]      = useState(false);
  const fileRef = useRef(null);

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

  const loadAll = useCallback(async () => {
    try {
      const [mRes, eRes, dRes, cRes] = await Promise.all([
        fetch(`/api/admin/metrics?period=${chartPeriod}`),
        fetch("/api/admin/escalations"),
        fetch("/api/documents"),
        fetch("/api/admin/config"),
      ]);
      if (mRes.ok) setMetrics(await mRes.json());
      if (eRes.ok) setEscalations(await eRes.json());
      if (dRes.ok) setDocuments(await dRes.json());
      if (cRes.ok) { const c = await cRes.json(); setThreshold(c.confidence_threshold); }
    } catch {}
  }, [chartPeriod]);

  useEffect(() => {
    loadAll();
    const id = setInterval(loadAll, 5000);
    return () => clearInterval(id);
  }, [loadAll]);

  async function saveThreshold() {
    const val = pendingThresh ?? threshold;
    try {
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confidence_threshold: val }),
      });
      if (res.ok) { setThreshold(val); setPendingThresh(null); addToast("Threshold saved", "success"); }
      else addToast("Failed to update", "danger");
    } catch { addToast("Network error", "danger"); }
  }

  async function resolve(sessionId) {
    try {
      const res = await fetch(`/api/admin/escalations/${encodeURIComponent(sessionId)}/resolve`, { method: "POST" });
      if (res.ok) { addToast("Escalation resolved ✓", "success"); await loadAll(); }
      else addToast("Failed to resolve", "danger");
    } catch { addToast("Network error", "danger"); }
  }

  async function sendReply(sessionId) {
    const msg = replies[sessionId]?.trim();
    if (!msg) return;
    setSendingReply((p) => ({ ...p, [sessionId]: true }));
    try {
      const res = await fetch(`/api/admin/escalations/${encodeURIComponent(sessionId)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg }),
      });
      if (res.ok) {
        addToast("Reply sent & resolved ✓", "success");
        setReplies((p) => { const n = { ...p }; delete n[sessionId]; return n; });
        await loadAll();
      } else {
        addToast("Failed to send reply", "danger");
      }
    } catch { addToast("Network error", "danger"); }
    finally { setSendingReply((p) => ({ ...p, [sessionId]: false })); }
  }

  async function uploadFile(e) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    const form = new FormData(); form.append("file", file);
    try {
      const res  = await fetch("/api/documents/ingest/file", { method: "POST", body: form });
      const data = await res.json();
      if (res.ok) { addToast(`"${file.name}" — ${data.chunks_count} chunks indexed`, "success"); await loadAll(); }
      else addToast(data.error || "Upload failed", "danger");
    } catch { addToast("Upload failed", "danger"); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  async function ingestUrl() {
    if (!urlInput.trim()) return;
    setIngesting(true);
    try {
      const res  = await fetch("/api/documents/ingest/url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: urlInput.trim(), name: urlName.trim() || undefined }),
      });
      const data = await res.json();
      if (res.ok) { addToast(`URL ingested — ${data.chunks_count} chunks`, "success"); setUrlInput(""); setUrlName(""); await loadAll(); }
      else addToast(data.error || "Ingest failed", "danger");
    } catch { addToast("Ingest failed", "danger"); }
    finally { setIngesting(false); }
  }

  async function removeDoc(id, name) {
    try {
      const res = await fetch(`/api/documents?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) { addToast(`"${name}" deleted`, "success"); await loadAll(); }
      else addToast("Delete failed", "danger");
    } catch { addToast("Network error", "danger"); }
  }

  const pending   = escalations.filter((e) => e.status === "pending");
  const resolved  = escalations.filter((e) => e.status === "resolved");
  const pendingCount = pending.length;
  const displayThresh = pendingThresh ?? threshold;


  /* CSAT: simple ratio from feedback */
  const up   = metrics?.feedback?.thumbs_up   || 0;
  const down = metrics?.feedback?.thumbs_down || 0;
  const csatScore = (up + down) > 0
    ? ((up / (up + down)) * 5).toFixed(1)
    : "—";

  /* ── Sidebar items ─────────────────────────────── */
  const SB_ITEMS = [
    { id: "overview",    icon: <LayoutDashboard size={18} />, label: "Overview",       onClick: () => { setTab("overview");    setHdrTab("analytics"); setMobileSb(false); } },
    { id: "escalations", icon: <MessageSquare   size={18} />, label: "Live Chat",      onClick: () => { setTab("escalations"); setHdrTab("tickets");   setMobileSb(false); } },
    { id: "kb",          icon: <BookOpen        size={18} />, label: "Knowledge Base", onClick: () => { setTab("kb");          setHdrTab("analytics"); setMobileSb(false); } },
    { id: "settings",    icon: <Settings        size={18} />, label: "Settings",       onClick: () => { setTab("settings");    setHdrTab("analytics"); setMobileSb(false); } },
  ];

  /* Map header tab → admin tab */
  function onHdrTab(t) {
    setHdrTab(t);
    if (t === "analytics") setTab("overview");
    if (t === "tickets")   setTab("escalations");
  }

  /* Active sidebar key */
  function isSbActive(id) {
    return id === tab;
  }

  /* ── Render ─────────────────────────────────────── */
  return (
    <div className="admin-root">

      {/* Mobile overlay */}
      {mobileSb && (
        <div className="admin-sb-overlay" onClick={() => setMobileSb(false)} />
      )}

      {/* ══ Sidebar ═══════════════════════════════ */}
      <motion.aside
        className={`admin-sb${mobileSb ? " mobile-open" : ""}`}
        initial={{ x: -40, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 280, damping: 28 }}
      >
        {/* Brand */}
        <div className="admin-sb-brand">
          <div className="admin-sb-logo">
            <LogoComponent size={32} />
          </div>
          <div>
            <div className="admin-sb-name">Resolve AI</div>
            <div className="admin-sb-status">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#34d399", flexShrink: 0,
                animation: "pulseDot 2s infinite" }} />
              Active Instance
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="admin-sb-nav">
          {SB_ITEMS.map(({ id, icon, label, onClick }) => (
            <button
              key={id}
              className={`admin-sb-item${isSbActive(id) ? " active" : ""}`}
              onClick={onClick}
            >
              {icon}
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div style={{ flex: 1 }} />

        {/* Back to chat */}
        <a href="/" className="admin-sb-item" style={{ textDecoration: "none" }}>
          <LayoutDashboard size={18} /><span>Back to Chat</span>
        </a>
      </motion.aside>

      {/* ══ Body ══════════════════════════════════ */}
      <div className="admin-body">

        {/* ── Header ─────────────────────────────── */}
        <motion.header
          className="admin-hdr"
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 280, damping: 26, delay: .1 }}
        >
          {/* Mobile hamburger */}
          <button className="admin-hdr-hamburger" onClick={() => setMobileSb((v) => !v)} aria-label="Menu">
            {mobileSb ? <X size={20} /> : <Menu size={20} />}
          </button>

          {/* Tabs */}
          <div className="admin-hdr-tabs">
            {[
              { id: "analytics", label: "Analytics" },
              { id: "tickets",   label: "Tickets"   },
            ].map(({ id, label }) => (
              <button
                key={id}
                className={`admin-hdr-tab${hdrTab === id ? " active" : ""}`}
                onClick={() => onHdrTab(id)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Right actions */}
          <div className="admin-hdr-actions" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button 
              onClick={handleLogout}
              className="btn btn-ghost btn-xs"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px" }}
            >
              <LogOut size={12} />
              <span>Log Out</span>
            </button>
            <div className="admin-hdr-avatar-wrap">
              <UserCircle2 size={32} strokeWidth={1.5} />
            </div>
          </div>
        </motion.header>

        {/* ── Content ────────────────────────────── */}
        <main className="admin-content">

          {/* ═══ OVERVIEW TAB ═══════════════════════ */}
          {tab === "overview" && (
            <motion.div initial="hidden" animate="show" variants={staggerGrid}>

              {/* KPI Cards */}
              <div className="kpi-grid">
                {[
                  {
                    label: "Total Sessions",
                    value: fmtNum(metrics?.total_sessions),
                    icon: <Users size={20} />,
                    trend: "+12.4%", trendDir: "up",
                    path: "M0,25 Q15,5 30,20 T60,10 T100,15",
                    sparkColor: "#b0c6ff",
                  },
                  {
                    label: "Total Queries",
                    value: fmtNum(metrics?.total_queries),
                    icon: <Activity size={20} />,
                    trend: "+8.2%", trendDir: "up",
                    path: "M0,20 Q20,25 40,5 T70,15 T100,2",
                    sparkColor: "#b0c6ff",
                  },
                  {
                    label: "AI Resolution Rate",
                    value: metrics ? metrics.resolution_rate : "—",
                    suffix: metrics ? "%" : "",
                    icon: <Sparkles size={20} />,
                    iconClass: "secondary",
                    trend: "Stable", trendDir: "stable",
                    path: "M0,15 L20,14 L40,15 L60,14 L80,15 L100,14",
                    sparkColor: "#d0bcff",
                    aiGlow: true,
                  },
                  {
                    label: "CSAT Score",
                    value: csatScore,
                    suffix: csatScore !== "—" ? "/5" : "",
                    icon: <ThumbsUp size={20} />,
                    trend: "-0.1", trendDir: "down",
                    path: "M0,5 Q25,10 50,15 T100,25",
                    sparkColor: "#b0c6ff",
                  },
                ].map(({ label, value, suffix = "", icon, iconClass, trend, trendDir, path, sparkColor, aiGlow }, i) => (
                  <motion.div
                    key={label}
                    className="kpi-card"
                    variants={fadeUp}
                    style={aiGlow ? { boxShadow: "0 0 15px rgba(138,92,245,.05)" } : {}}
                  >
                    <div className="kpi-card-top">
                      <span className="kpi-card-label">{label}</span>
                      <span className={`kpi-card-icon${iconClass ? ` ${iconClass}` : ""}`}>{icon}</span>
                    </div>
                    <div className="kpi-card-value">
                      <AnimCounter value={value} suffix={suffix} />
                    </div>
                    <div className="kpi-card-bottom">
                      <span className={`kpi-card-trend ${trendDir}`}>
                        {trendDir === "up"     && <TrendingUp   size={13} />}
                        {trendDir === "down"   && <TrendingDown size={13} />}
                        {trendDir === "stable" && <span style={{ width: 8, height: 2, background: "currentColor", borderRadius: 2, display: "inline-block", marginRight: 2 }} />}
                        {trend}
                      </span>
                      <Sparkline path={path} color={sparkColor} />
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Charts row */}
              <div className="charts-row">
                {/* Bar chart */}
                <motion.div className="card" variants={fadeUp} whileHover={{ y: -3 }}>
                  <div className="card-header">
                    <span className="card-title">
                      <BarChart2 size={14} style={{ color: "var(--primary)" }} /> Query Analytics
                    </span>
                    <div style={{ display: "flex", gap: 4 }}>
                      {[
                        { id: "7d", label: "7D" },
                        { id: "30d", label: "30D" }
                      ].map((item) => {
                        const active = chartPeriod === item.id;
                        return (
                          <button 
                            key={item.id} 
                            onClick={() => setChartPeriod(item.id)}
                            style={{
                              padding: "3px 10px",
                              fontSize: ".625rem",
                              fontFamily: "'JetBrains Mono', monospace",
                              background: active ? "rgba(84,23,190,.15)" : "transparent",
                              border: "1px solid",
                              borderColor: active ? "rgba(84,23,190,.3)" : "transparent",
                              borderRadius: 4,
                              color: active ? "var(--secondary)" : "var(--text-3)",
                              cursor: "pointer",
                            }}
                          >
                            {item.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="card-body" style={{ minHeight: 220 }}>
                    <BarChart data={metrics?.query_trend} is30d={chartPeriod === "30d"} />
                  </div>

                </motion.div>

                {/* Donut chart */}
                <motion.div className="card" variants={fadeUp} whileHover={{ y: -3 }}>
                  <div className="card-header">
                    <span className="card-title">
                      <Sparkles size={14} style={{ color: "var(--secondary)" }} /> Sentiment Pulse
                    </span>
                  </div>
                  <div className="card-body" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                    <DonutChart
                      thumbsUp={metrics?.feedback?.thumbs_up   || 0}
                      thumbsDown={metrics?.feedback?.thumbs_down || 0}
                    />
                    <div style={{
                      width: "100%", marginTop: 24,
                      display: "flex", justifyContent: "space-around",
                      borderTop: "1px solid #424655", paddingTop: 20,
                    }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: ".5rem", color: "var(--text-3)", marginBottom: 4 }}>
                          Thumbs Up
                        </div>
                        <div style={{ fontFamily: "Geist, sans-serif", fontSize: "1.25rem", fontWeight: 700, color: "var(--primary)" }}>
                          {fmtNum(metrics?.feedback?.thumbs_up || 0)}
                        </div>
                      </div>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: ".5rem", color: "var(--text-3)", marginBottom: 4 }}>
                          Thumbs Down
                        </div>
                        <div style={{ fontFamily: "Geist, sans-serif", fontSize: "1.25rem", fontWeight: 700, color: "var(--secondary)" }}>
                          {fmtNum(metrics?.feedback?.thumbs_down || 0)}
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Recent Feedback Activity table */}
              <motion.div className="card" variants={fadeUp}>
                <div className="card-header">
                  <span className="card-title">
                    <Activity size={14} style={{ color: "var(--primary)" }} /> Recent Feedback Activity
                  </span>
                  <button style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: ".6875rem", color: "var(--primary)", background: "none", border: "none", cursor: "pointer" }}
                    onClick={() => setTab("escalations")}>
                    View All
                  </button>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table className="fb-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Rating</th>
                        <th>Comment</th>
                        <th className="right">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics?.top_escalated_queries?.slice(0, 5).map((q, i) => {
                        const avc = AVATAR_COLORS[i % AVATAR_COLORS.length];
                        const initials = (q.session_id || "??").replace(/[^a-zA-Z0-9]/g, "").slice(0, 2).toUpperCase();
                        const isNeg = q.reason === "negative_feedback";
                        return (
                          <tr key={i} style={{ transition: "all .2s" }}>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <div className="fb-table-avatar" style={{ background: avc.bg, color: avc.color }}>{initials}</div>
                                <span style={{ fontFamily: "Inter, sans-serif", fontSize: ".875rem", fontWeight: 500, color: "var(--text)" }}>
                                  Session {fmtSessionId(q.session_id || `s${i}`)}
                                </span>
                              </div>
                            </td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 5, color: isNeg ? "var(--red)" : "var(--green)" }}>
                                {isNeg ? <ThumbsDown size={14} /> : <ThumbsUp size={14} />}
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: ".75rem", fontWeight: 500 }}>
                                  {isNeg ? "Unclear" : "Helpful"}
                                </span>
                              </div>
                            </td>
                            <td style={{ fontFamily: "Inter, sans-serif", fontSize: ".875rem", color: "var(--text-3)" }}>
                              &ldquo;{(q.content || "N/A").slice(0, 72)}&rdquo;
                            </td>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: ".625rem", color: "var(--text-3)", textAlign: "right" }}>
                              {timeAgo(q.created_at)}
                            </td>
                          </tr>
                        );
                      }) || (
                        <tr>
                          <td colSpan={4} style={{ textAlign: "center", padding: "32px", color: "var(--text-3)", fontFamily: "Inter, sans-serif", fontSize: ".875rem" }}>
                            No feedback activity yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              {/* Escalation by topic */}
              {metrics?.topics && Object.keys(metrics.topics).length > 0 && (
                <motion.div className="card" variants={fadeUp} style={{ marginTop: 24 }}>
                  <div className="card-header">
                    <span className="card-title">
                      <AlertTriangle size={14} style={{ color: "var(--red)" }} /> Escalation Frequency by Topic
                    </span>
                    <span className="badge badge-neutral">{Object.keys(metrics.topics).length} topics</span>
                  </div>
                  <div className="card-body">
                    {(() => {
                      const entries = Object.entries(metrics.topics).sort(([, a], [, b]) => b - a);
                      const maxVal  = Math.max(...entries.map(([, v]) => v), 1);
                      return (
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          {entries.map(([topic, count], i) => (
                            <motion.div key={topic} style={{ display: "flex", alignItems: "center", gap: 12 }}
                              initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * .06 }}>
                              <span style={{ minWidth: 130, fontSize: ".875rem", color: "var(--text-2)", fontWeight: 500 }}>{topic}</span>
                              <div style={{ flex: 1, background: "var(--surface-2)", borderRadius: 4, overflow: "hidden", height: 8 }}>
                                <motion.div
                                  style={{ height: "100%", background: "linear-gradient(90deg,var(--primary-bright),var(--secondary))", borderRadius: 4 }}
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(count / maxVal) * 100}%` }}
                                  transition={{ delay: i * .06 + .1, type: "spring", stiffness: 120, damping: 20 }}
                                />
                              </div>
                              <span style={{ minWidth: 24, fontSize: ".875rem", fontWeight: 700, color: "var(--text)", textAlign: "right" }}>{count}</span>
                            </motion.div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══ ESCALATIONS TAB ════════════════════ */}
          {tab === "escalations" && (
            <motion.div initial="hidden" animate="show" variants={staggerGrid}>
              {/* Section header */}
              <motion.div variants={fadeUp} style={{ marginBottom: 28 }}>
                <h2 style={{ fontFamily: "Geist, sans-serif", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.035em", color: "var(--text)", marginBottom: 4 }}>
                  Escalation Queue
                </h2>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: ".9375rem", color: "var(--text-3)" }}>
                  Managing {pendingCount} high-priority AI handoff{pendingCount !== 1 ? "s" : ""}
                </p>
              </motion.div>

              {/* Controls */}
              <motion.div variants={fadeUp} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                {[
                  { id: "active",   label: "Active",   count: pending.length },
                  { id: "resolved", label: "Resolved", count: resolved.length },
                ].map(({ id, label, count }) => (
                  <button key={id} onClick={() => setEscalView(id)}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 8,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: ".75rem",
                      fontWeight: 500,
                      cursor: "pointer",
                      border: "1px solid",
                      transition: "all .15s",
                      background: escalView === id ? "var(--secondary-container)" : "transparent",
                      color:      escalView === id ? "#c0a7ff" : "var(--text-3)",
                      borderColor: escalView === id ? "rgba(84,23,190,.4)" : "var(--border)",
                    }}>
                    {label}
                    {count > 0 && (
                      <span style={{
                        marginLeft: 6, padding: "1px 6px",
                        background: id === "active" ? "rgba(255,180,171,.15)" : "rgba(52,211,153,.1)",
                        color: id === "active" ? "var(--red)" : "var(--green)",
                        borderRadius: 4, fontSize: ".5rem",
                      }}>
                        {count}
                      </span>
                    )}
                  </button>
                ))}
                <button style={{
                  marginLeft: "auto",
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: ".75rem",
                  color: "var(--text-3)",
                  cursor: "pointer",
                }}>
                  <Filter size={13} /> Filters
                </button>
              </motion.div>

              {/* Escalation cards grid */}
              {(() => {
                const list = escalView === "active" ? pending : resolved;
                if (!list.length) {
                  return (
                    <motion.div variants={fadeUp} className="card" style={{ padding: "48px 24px", textAlign: "center" }}>
                      <CheckCircle size={32} style={{ color: "var(--green)", margin: "0 auto 12px" }} />
                      <p style={{ fontFamily: "Inter, sans-serif", color: "var(--text-3)" }}>
                        {escalView === "active" ? "Queue is clear — AI is handling everything!" : "No resolved escalations yet."}
                      </p>
                    </motion.div>
                  );
                }
                return (
                  <div className="esc-grid-v2">
                    {list.map((e, idx) => {
                      const priority  = getPriority(e.reason);
                      const sentiment = getSentiment(e.reason);
                      return (
                        <motion.div key={e.id} className="esc-card-v2" variants={fadeUp} layout>
                          {/* Top badges */}
                          <div className="esc-card-top">
                            <span className="esc-badge-session">{fmtSessionId(e.session_id)}</span>
                            <span className={`esc-badge-priority ${priority.toLowerCase()}`}>{priority}</span>
                            <span className={`esc-badge-sentiment ${sentiment.toLowerCase()}`}>
                              <span className="sentiment-dot" />
                              {sentiment}
                            </span>
                          </div>

                          {/* Title */}
                          <div className="esc-card-title">{e.topic || "Support Request"}</div>

                          {/* Reason */}
                          <div className="esc-card-reason">
                            <span className="esc-reason-label">Escalation Reason</span>
                            <span className="esc-reason-text" style={{ display: "block", marginTop: "4px" }}>
                              <strong>{reasonLabel(e.reason)}</strong>
                              {e.summary && (
                                <span style={{ display: "block", marginTop: "4px" }}>
                                  {expandedSession === e.session_id ? (
                                    <div 
                                      className="esc-summary-expanded" 
                                      style={{ 
                                        padding: "10px", 
                                        background: "rgba(0,0,0,0.25)", 
                                        borderRadius: "6px", 
                                        border: "1px solid var(--border)", 
                                        whiteSpace: "pre-wrap", 
                                        color: "var(--text-2)",
                                        fontSize: "0.8125rem",
                                        lineHeight: "1.4",
                                        marginTop: "6px",
                                        marginBottom: "6px"
                                      }}
                                    >
                                      {e.summary}
                                    </div>
                                  ) : (
                                    <span> — {(e.summary || "").slice(0, 90)}...</span>
                                  )}
                                  <button 
                                    onClick={() => setExpandedSession(expandedSession === e.session_id ? null : e.session_id)}
                                    style={{
                                      background: "none",
                                      border: "none",
                                      color: "var(--primary)",
                                      fontSize: "0.6875rem",
                                      fontFamily: "'JetBrains Mono', monospace",
                                      cursor: "pointer",
                                      padding: "2px 0",
                                      display: "inline-block",
                                      textDecoration: "underline",
                                    }}
                                  >
                                    {expandedSession === e.session_id ? "Show Less" : "Expand Summary"}
                                  </button>
                                </span>
                              )}
                            </span>
                          </div>

                          {/* Time */}
                          <div className="esc-card-time">
                            <Clock size={10} style={{ display: "inline", marginRight: 4 }} />
                            Last Event · {timeAgo(e.created_at)}
                          </div>

                          {/* Actions */}
                          <div className="esc-card-actions">
                            {e.status === "pending" && (
                              <>
                                <textarea
                                  className="esc-reply-input"
                                  placeholder="Type a reply to the user..."
                                  rows={2}
                                  value={replies[e.session_id] || ""}
                                  onChange={(ev) => setReplies((p) => ({ ...p, [e.session_id]: ev.target.value }))}
                                  onKeyDown={(ev) => {
                                    if (ev.key === "Enter" && (ev.metaKey || ev.ctrlKey)) sendReply(e.session_id);
                                  }}
                                />
                                <div style={{ display: "flex", gap: 8 }}>
                                  <motion.button
                                    className="esc-action-btn reply"
                                    onClick={() => sendReply(e.session_id)}
                                    disabled={!replies[e.session_id]?.trim() || sendingReply[e.session_id]}
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}>
                                    {sendingReply[e.session_id] ? "Sending…" : "Send & Resolve"}
                                  </motion.button>
                                  <motion.button
                                    className="esc-action-btn resolve"
                                    onClick={() => resolve(e.session_id)}
                                    whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}>
                                    Resolve
                                  </motion.button>
                                </div>
                              </>
                            )}
                            {e.status === "resolved" && (
                              <span className="resolved-badge"><CheckCircle size={10} /> Resolved</span>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* Active Escalation Stream table */}
              {escalations.length > 0 && (
                <motion.div className="card stream-section" variants={fadeUp} style={{ marginTop: 8 }}>
                  <div className="card-header">
                    <span className="card-title">
                      <Activity size={14} style={{ color: "var(--cyan)" }} /> Active Escalation Stream
                    </span>
                    <span className="badge badge-neutral">{escalations.length} total</span>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="stream-table">
                      <thead>
                        <tr>
                          <th>Session ID</th>
                          <th>Topic</th>
                          <th>Reason</th>
                          <th>Status</th>
                          <th>Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {escalations.map((e, i) => (
                          <tr key={e.id}>
                            <td className="mono">{fmtSessionId(e.session_id)}</td>
                            <td style={{ fontFamily: "Inter, sans-serif", fontSize: ".875rem", color: "var(--text)" }}>
                              {e.topic || "General"}
                            </td>
                            <td>
                              <span className={`badge ${e.reason === "low_confidence" ? "badge-amber" : e.reason === "negative_feedback" ? "badge-red" : "badge-neutral"}`}>
                                {reasonLabel(e.reason)}
                              </span>
                            </td>
                            <td>
                              <span className={`badge ${e.status === "pending" ? "badge-amber" : "badge-green"}`}>
                                {e.status}
                              </span>
                            </td>
                            <td className="mono">{timeAgo(e.created_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══ KNOWLEDGE BASE TAB ═════════════════ */}
          {tab === "kb" && (
            <motion.div initial="hidden" animate="show" variants={staggerGrid}>
              <motion.div variants={fadeUp} style={{ marginBottom: 28 }}>
                <h2 style={{ fontFamily: "Geist, sans-serif", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.035em", color: "var(--text)", marginBottom: 4 }}>
                  Knowledge Base
                </h2>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: ".9375rem", color: "var(--text-3)" }}>
                  Upload documents or ingest URLs to power the AI.
                </p>
              </motion.div>

              {/* Upload zone */}
              <motion.div variants={fadeUp}>
                <label className="kb-upload-zone" htmlFor="file-upload">
                  <motion.div style={{ color: "var(--primary)", marginBottom: 8 }}
                    animate={uploading ? { rotate: 360 } : { rotate: 0 }}
                    transition={uploading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}>
                    <Upload size={28} />
                  </motion.div>
                  <p>{uploading ? "Processing document…" : "Click to upload a file"}</p>
                  <span>PDF · Markdown · Plain text</span>
                  <input id="file-upload" ref={fileRef} type="file" accept=".pdf,.md,.txt,.markdown" onChange={uploadFile} disabled={uploading} />
                </label>
              </motion.div>

              {/* URL ingest */}
              <motion.div className="card" style={{ marginBottom: 20 }} variants={fadeUp}>
                <div className="card-header">
                  <span className="card-title"><Globe size={14} style={{ color: "var(--cyan)" }} /> Ingest from URL</span>
                </div>
                <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="url-row">
                    <input className="input" type="url" placeholder="https://example.com/docs/page"
                      value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && ingestUrl()} />
                    <motion.button className="btn btn-primary" onClick={ingestUrl}
                      disabled={ingesting || !urlInput.trim()} style={{ flexShrink: 0 }}
                      whileHover={{ scale: 1.04 }} whileTap={{ scale: .97 }}>
                      {ingesting ? "…" : <><Globe size={13} /> Ingest</>}
                    </motion.button>
                  </div>
                  <input className="input" type="text" placeholder="Display name (optional)"
                    value={urlName} onChange={(e) => setUrlName(e.target.value)} />
                </div>
              </motion.div>

              {/* Document list */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <h3 style={{ fontSize: ".9375rem", display: "flex", alignItems: "center", gap: 7, color: "var(--text)" }}>
                  <BookOpen size={15} style={{ color: "var(--primary)" }} /> Ingested Documents
                </h3>
                <span className="badge badge-indigo">{documents.length} files</span>
              </div>

              {!documents.length ? (
                <div className="empty">
                  <div className="empty-icon"><BookOpen size={22} /></div>
                  <p>No documents yet. Upload one above to get started.</p>
                </div>
              ) : (
                <motion.div className="doc-list" variants={staggerGrid} initial="hidden" animate="show">
                  {documents.map((doc) => {
                    const { cls, el } = docIcon(doc.type);
                    return (
                      <motion.div key={doc.id} className="doc-item" variants={fadeUp} whileHover={{ x: 3 }} layout>
                        <div className={`doc-icon ${cls}`}>{el}</div>
                        <div className="doc-info">
                          <div className="doc-name">{doc.name}</div>
                          <div className="doc-meta">{doc.type.toUpperCase()} · {fmtDate(doc.created_at)}</div>
                        </div>
                        <motion.button className="btn btn-danger btn-sm" onClick={() => removeDoc(doc.id, doc.name)}
                          whileHover={{ scale: 1.08 }} whileTap={{ scale: .92 }}>
                          <Trash2 size={13} />
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══ SETTINGS TAB ═══════════════════════ */}
          {tab === "settings" && (
            <motion.div initial="hidden" animate="show" variants={staggerGrid}>
              <motion.div variants={fadeUp} style={{ marginBottom: 28 }}>
                <h2 style={{ fontFamily: "Geist, sans-serif", fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-.035em", color: "var(--text)", marginBottom: 4 }}>
                  Settings
                </h2>
                <p style={{ fontFamily: "Inter, sans-serif", fontSize: ".9375rem", color: "var(--text-3)" }}>
                  Tune AI behaviour and review platform configuration.
                </p>
              </motion.div>

              <motion.div className="card" style={{ maxWidth: 520, marginBottom: 16 }} variants={fadeUp}>
                <div className="card-header">
                  <span className="card-title"><Zap size={14} style={{ color: "var(--amber)" }} /> Confidence Threshold</span>
                </div>
                <div className="card-body">
                  <div className="threshold-row">
                    <motion.div className="threshold-val" key={displayThresh.toFixed(2)}
                      initial={{ scale: .8, opacity: .5 }} animate={{ scale: 1, opacity: 1 }}>
                      {displayThresh.toFixed(2)}
                    </motion.div>
                    <div className="threshold-desc">Below this similarity score, queries escalate to a human agent.</div>
                  </div>
                  <input type="range" min="0" max="1" step="0.01" value={displayThresh}
                    onChange={(e) => setPendingThresh(parseFloat(e.target.value))} className="range-input" />
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20, marginTop: 6 }}>
                    <span style={{ fontSize: ".625rem", color: "var(--text-3)" }}>0 — escalate more</span>
                    <span style={{ fontSize: ".625rem", color: "var(--text-3)" }}>1 — escalate less</span>
                  </div>
                  <motion.button className="btn btn-primary" onClick={saveThreshold}
                    disabled={pendingThresh === null || pendingThresh === threshold}
                    whileHover={{ scale: 1.03 }} whileTap={{ scale: .97 }}>
                    <CheckCircle size={13} /> Save Threshold
                  </motion.button>
                </div>
              </motion.div>

              <motion.div className="card" style={{ maxWidth: 520 }} variants={fadeUp}>
                <div className="card-header">
                  <span className="card-title"><Info size={14} style={{ color: "var(--cyan)" }} /> Platform Stack</span>
                </div>
                <div className="card-body" style={{ padding: "14px 18px" }}>
                  {[
                    { label: "AI Model",     value: "Gemini 2.5 Flash / Groq Llama", color: "var(--violet)" },
                    { label: "Embeddings",   value: "MiniLM-L6-v2 (384-dim)",        color: "var(--primary)" },
                    { label: "Vector Store", value: "Qdrant (SQLite fallback)",       color: "var(--cyan)" },
                    { label: "Database",     value: "SQLite (better-sqlite3)",        color: "var(--green)" },
                  ].map(({ label, value, color }, i) => (
                    <motion.div key={label}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 0", borderBottom: "1px solid var(--border)" }}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * .07 }}>
                      <span style={{ fontSize: ".875rem", color: "var(--text-3)" }}>{label}</span>
                      <span style={{ fontSize: ".875rem", fontWeight: 600, color }}>{value}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}

        </main>
      </div>

      <Toasts toasts={toasts} />
    </div>
  );
}
