"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BackgroundOrbs from "@/components/BackgroundOrbs";
import Logo from "@/components/Logo";
import { Lock, Mail, AlertCircle, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Login failed");
        setLoading(false);
        return;
      }

      // Login success, redirect based on role
      if (data.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/");
      }
      router.refresh();
    } catch (err) {
      setError("Network error occurred. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="chat-root" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
      <BackgroundOrbs />
      <div 
        className="card" 
        style={{
          width: "100%",
          maxWidth: "420px",
          padding: "32px 28px",
          boxShadow: "var(--shadow-lg), var(--ai-glow)",
          margin: "0 16px",
          zIndex: 2,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "28px" }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, overflow: "hidden", marginBottom: "16px" }}>
            <Logo size={48} />
          </div>
          <h1 className="gradient-text" style={{ fontSize: "1.75rem", marginBottom: "6px" }}>Resolve AI</h1>
          <p style={{ color: "var(--text-3)", fontSize: "0.875rem", textAlign: "center" }}>
            Enter your credentials to access your dashboard
          </p>
        </div>

        {error && (
          <div 
            style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "10px", 
              padding: "12px 14px", 
              background: "var(--red-dim)", 
              border: "1px solid rgba(255, 180, 171, 0.2)", 
              borderRadius: "var(--r-sm)", 
              color: "var(--red)", 
              fontSize: "0.8125rem",
              marginBottom: "20px"
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "6px", letterSpacing: "0.05em" }}>
              Email Address
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", display: "flex", alignItems: "center" }}>
                <Mail size={16} />
              </span>
              <input
                type="email"
                required
                className="input"
                placeholder="user@resolve.ai or admin@resolve.ai"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: "38px" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", color: "var(--text-3)", marginBottom: "6px", letterSpacing: "0.05em" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", display: "flex", alignItems: "center" }}>
                <Lock size={16} />
              </span>
              <input
                type="password"
                required
                className="input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: "38px" }}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={loading}
            style={{ 
              marginTop: "12px", 
              padding: "12px", 
              fontSize: "0.875rem", 
              display: "flex", 
              justifyContent: "center", 
              gap: "8px", 
              width: "100%" 
            }}
          >
            {loading ? "Signing in..." : "Sign In"}
            {!loading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Test Credentials Section */}
        <div
          style={{
            marginTop: "24px",
            padding: "16px",
            background: "rgba(99, 102, 241, 0.06)",
            border: "1px solid rgba(99, 102, 241, 0.15)",
            borderRadius: "var(--r-sm)",
          }}
        >
          <p
            style={{
              fontSize: "0.6875rem",
              fontFamily: "'JetBrains Mono', monospace",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--primary)",
              marginBottom: "12px",
              fontWeight: 600,
            }}
          >
            🧪 Test Credentials
          </p>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={() => {
                setEmail("user@resolve.ai");
                setPassword("Resolve@123");
                setError("");
              }}
              style={{
                flex: 1,
                padding: "10px 8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "var(--r-sm)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.1)";
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--text-2)", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                👤 User
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--text-3)", display: "block" }}>
                user@resolve.ai
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--text-3)", display: "block" }}>
                Resolve@123
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEmail("admin@resolve.ai");
                setPassword("Resolve@123");
                setError("");
              }}
              style={{
                flex: 1,
                padding: "10px 8px",
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "var(--r-sm)",
                cursor: "pointer",
                textAlign: "left",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(99, 102, 241, 0.1)";
                e.currentTarget.style.borderColor = "rgba(99, 102, 241, 0.3)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--text-2)", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                🛡️ Admin
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--text-3)", display: "block" }}>
                admin@resolve.ai
              </span>
              <span style={{ fontSize: "0.6875rem", color: "var(--text-3)", display: "block" }}>
                Resolve@123
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
