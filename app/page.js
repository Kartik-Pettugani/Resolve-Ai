"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ChatInterface from "@/components/ChatInterface";

function getSessionId() {
  let sessionId = window.localStorage.getItem("support_session_id");
  if (!sessionId) {
    sessionId = `session_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem("support_session_id", sessionId);
  }
  return sessionId;
}

export default function HomePage() {
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  return (
    <main className="shell">
      <header className="topbar glass">
        <div className="brand-wrap">
          <h1>Resolve</h1>
        </div>
        <div className="nav-right">
          <Link href="/admin" className="outline-btn">Open Admin</Link>
        </div>
      </header>

      <div className="chat-container">
        <ChatInterface sessionId={sessionId} />
      </div>
    </main>
  );
}
