"use client";
import { useState, useEffect } from "react";
import { AmexCsvUploader } from "@/components/AmexCsvUploader";
import { AmexCsvAnalysis } from "@/components/AmexCsvAnalysis";
import { parseAmexCsv, type ParseResult } from "@/lib/amex-parser";
import { Cloud, CloudOff, Clock } from "lucide-react";

const SHARED_KEY  = "amex_csv";
const LS_KEY_CSV  = "amex_csv_text";
const LS_KEY_NAME = "amex_csv_filename";

type SyncState = "idle" | "saving" | "saved" | "error";

export function AmexClientSection() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName,    setFileName]    = useState<string | undefined>();
  const [syncState,   setSyncState]   = useState<SyncState>("idle");
  const [lastSaved,   setLastSaved]   = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/shared?key=${SHARED_KEY}`);
        const json = await res.json();
        if (json.data?.csvText && json.data?.fileName) {
          const result = parseAmexCsv(json.data.csvText);
          if (result.rows.length > 0) {
            setParseResult(result);
            setFileName(json.data.fileName);
            setLastSaved(json.data.updated_at ?? null);
            localStorage.setItem(LS_KEY_CSV,  json.data.csvText);
            localStorage.setItem(LS_KEY_NAME, json.data.fileName);
            return;
          }
        }
      } catch { /* fallback */ }
      const saved     = localStorage.getItem(LS_KEY_CSV);
      const savedName = localStorage.getItem(LS_KEY_NAME);
      if (saved && savedName) {
        const result = parseAmexCsv(saved);
        if (result.rows.length > 0) { setParseResult(result); setFileName(savedName); }
      }
    }
    load();
  }, []);

  async function handleParsed(result: ParseResult, name: string, rawText: string) {
    setParseResult(result); setFileName(name);
    localStorage.setItem(LS_KEY_CSV, rawText); localStorage.setItem(LS_KEY_NAME, name);
    setSyncState("saving");
    try {
      const res = await fetch("/api/shared", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: SHARED_KEY, value: { csvText: rawText, fileName: name, updated_at: new Date().toISOString() } }),
      });
      if (res.ok) { setSyncState("saved"); setLastSaved(new Date().toISOString()); }
      else          setSyncState("error");
    } catch { setSyncState("error"); }
  }

  async function handleClear() {
    setParseResult(null); setFileName(undefined); setSyncState("idle"); setLastSaved(null);
    localStorage.removeItem(LS_KEY_CSV); localStorage.removeItem(LS_KEY_NAME);
    await fetch("/api/shared", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: SHARED_KEY, value: {} }),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Temp notice */}
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 16px", borderRadius: "var(--r-md)",
        border: "1px solid #FDE68A", background: "#FFFBEB",
        fontSize: 13, color: "#92400E",
      }}>
        <Clock size={14} style={{ marginTop: 1, flexShrink: 0, color: "#D97706" }} />
        <span>
          <strong>Temporary:</strong> CSV upload is a manual step until the Amex API integration is live.
          Export from <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 12 }}>amex.com → Statement &amp; Activity → Download → CSV</span>.
        </span>
      </div>

      {/* Sync status */}
      {syncState === "saving" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--ink-3)" }}>
          <Cloud size={13} style={{ opacity: 0.6 }} /> Saving to shared storage…
        </div>
      )}
      {syncState === "saved" && lastSaved && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--accent)" }}>
          <Cloud size={13} />
          Shared — teammates will see this CSV automatically.
          <span style={{ color: "var(--ink-4)", marginLeft: 4 }}>
            Last updated {new Date(lastSaved).toLocaleString()}
          </span>
        </div>
      )}
      {syncState === "error" && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--danger)" }}>
          <CloudOff size={13} /> Could not save to shared storage — data is only local.
        </div>
      )}

      <AmexCsvUploader
        onParsed={handleParsed}
        onClear={handleClear}
        hasData={parseResult !== null}
        fileName={fileName}
      />

      {parseResult && <AmexCsvAnalysis result={parseResult} />}
    </div>
  );
}
