"use client";
import { useState } from "react";
import { Lock } from "lucide-react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(false);
  const [loading,  setLoading]  = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Full reload so the cookie is flushed to the browser
        // before the middleware runs on any subsequent page.
        window.location.href = "/";
      } else {
        setError(true);
        setPassword("");
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--bg)",
    }}>
      <div style={{
        width: 360,
        border: "1px solid var(--line)",
        borderRadius: "var(--r-lg)",
        background: "var(--panel)",
        padding: "36px 32px",
        boxShadow: "0 24px 48px rgba(0,0,0,.07)",
      }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: "var(--ink)",
            display: "grid", placeItems: "center",
            color: "var(--bg)", fontWeight: 700, fontSize: 14, letterSpacing: "-0.02em",
          }}>S</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.01em" }}>SaaS Usage</div>
            <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>AI spend dashboard</div>
          </div>
        </div>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <Lock size={15} style={{ color: "var(--ink-3)" }} />
          <span style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}>Sign in</span>
        </div>
        <p style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 22, lineHeight: 1.5 }}>
          Enter your dashboard password to continue.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="password"
            autoFocus
            placeholder="Password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            style={{
              width: "100%", boxSizing: "border-box",
              border: `1px solid ${error ? "var(--danger)" : "var(--line)"}`,
              borderRadius: "var(--r-sm)",
              background: "var(--panel-2)",
              color: "var(--ink)",
              padding: "10px 14px",
              fontSize: 14,
              outline: "none",
            }}
          />
          {error && (
            <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>
              Incorrect password. Try again.
            </p>
          )}
          <button
            type="submit"
            disabled={loading || !password}
            style={{
              border: "none",
              borderRadius: "var(--r-sm)",
              background: "var(--ink)",
              color: "var(--bg)",
              padding: "10px 0",
              fontSize: 14, fontWeight: 500,
              cursor: loading || !password ? "default" : "pointer",
              opacity: loading || !password ? 0.5 : 1,
              transition: "opacity .15s",
            }}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
