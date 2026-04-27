"use client";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function Topbar() {
  const [dark, setDark] = useState(false);

  /* Persist preference */
  useEffect(() => {
    const saved = localStorage.getItem("theme");
    if (saved === "dark") { setDark(true); document.documentElement.setAttribute("data-theme", "dark"); }
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.setAttribute("data-theme", "dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
      localStorage.setItem("theme", "light");
    }
  }

  return (
    <header style={{
      height: 56, flexShrink: 0,
      borderBottom: "1px solid var(--line)",
      background: "var(--panel)",
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 32px",
    }}>
      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--ink-3)" }}>
        <span>Workspace</span>
        <span style={{ color: "var(--ink-4)" }}>/</span>
        <span style={{ color: "var(--ink)", fontWeight: 500 }}>AI spend</span>
      </div>

      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        title={dark ? "Switch to light mode" : "Switch to dark mode"}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: 34, height: 34, borderRadius: "var(--r-sm)",
          border: "1px solid var(--line)", background: "var(--panel-2)",
          color: "var(--ink-3)", cursor: "pointer",
          transition: "background .15s, color .15s",
        }}
      >
        {dark ? <Sun size={15} /> : <Moon size={15} />}
      </button>
    </header>
  );
}
