"use client";

import { useEffect, useState } from "react";
import ChatInterface from "@/components/ChatInterface";
import BackgroundOrbs from "@/components/BackgroundOrbs";

function genSessionId() {
  let id = window.localStorage.getItem("resolve_session_id");
  if (!id) {
    id = `s_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    window.localStorage.setItem("resolve_session_id", id);
  }
  return id;
}

export default function HomePage() {
  const [sessionId, setSessionId] = useState("");
  useEffect(() => setSessionId(genSessionId()), []);

  return (
    <div className="chat-root">
      <BackgroundOrbs />
      {sessionId && <ChatInterface sessionId={sessionId} />}
    </div>
  );
}
