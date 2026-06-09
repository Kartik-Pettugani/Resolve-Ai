"use client";

import Link from "next/link";
import AdminDashboard from "@/components/AdminDashboard";

export default function AdminPage() {
  return (
    <main className="shell">
      <header className="topbar glass">
        <div className="brand-wrap">
          <p className="kicker">Operations</p>
          <h1>Resolve Console</h1>
          <p className="subtitle">Monitor unresolved patterns, ingest KB, and resolve escalations.</p>
        </div>
        <div className="nav-right">
          <Link href="/" className="outline-btn">Back to Chat</Link>
        </div>
      </header>
      <AdminDashboard />
    </main>
  );
}
