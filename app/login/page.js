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
      </div>
    </div>
  );
}
