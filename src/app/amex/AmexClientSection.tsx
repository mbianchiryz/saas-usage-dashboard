"use client";
import { useState, useEffect } from "react";
import { AmexCsvUploader } from "@/components/AmexCsvUploader";
import { AmexCsvAnalysis } from "@/components/AmexCsvAnalysis";
import { parseAmexCsv, type ParseResult } from "@/lib/amex-parser";
import { Clock, Cloud, CloudOff } from "lucide-react";

const SHARED_KEY = "amex_csv";
const LS_KEY_CSV  = "amex_csv_text";
const LS_KEY_NAME = "amex_csv_filename";

type SyncState = "idle" | "saving" | "saved" | "error";

export function AmexClientSection() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName]       = useState<string | undefined>();
  const [syncState, setSyncState]     = useState<SyncState>("idle");
  const [lastSaved, setLastSaved]     = useState<string | null>(null);

  // On mount: try Supabase first, fallback to localStorage
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/shared?key=${SHARED_KEY}`);
        const json = await res.json();
        if (json.data?.csvText && json.data?.fileName) {
          const result = parseAmexCsv(json.data.csvText);
          if (result.rows.length > 0) {
            setParseResult(result);
            setFileName(json.data.fileName);
            setLastSaved(json.data.updated_at ?? null);
            // Keep localStorage in sync
            localStorage.setItem(LS_KEY_CSV,  json.data.csvText);
            localStorage.setItem(LS_KEY_NAME, json.data.fileName);
            return;
          }
        }
      } catch { /* network error — fall through to localStorage */ }

      // Fallback: localStorage
      const saved     = localStorage.getItem(LS_KEY_CSV);
      const savedName = localStorage.getItem(LS_KEY_NAME);
      if (saved && savedName) {
        const result = parseAmexCsv(saved);
        if (result.rows.length > 0) {
          setParseResult(result);
          setFileName(savedName);
        }
      }
    }
    load();
  }, []);

  async function handleParsed(result: ParseResult, name: string, rawText: string) {
    setParseResult(result);
    setFileName(name);

    // Save to localStorage immediately
    localStorage.setItem(LS_KEY_CSV,  rawText);
    localStorage.setItem(LS_KEY_NAME, name);

    // Save to Supabase (shared)
    setSyncState("saving");
    try {
      const res = await fetch("/api/shared", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ key: SHARED_KEY, value: { csvText: rawText, fileName: name, updated_at: new Date().toISOString() } }),
      });
      if (res.ok) {
        setSyncState("saved");
        setLastSaved(new Date().toISOString());
      } else {
        setSyncState("error");
      }
    } catch {
      setSyncState("error");
    }
  }

  async function handleClear() {
    setParseResult(null);
    setFileName(undefined);
    setSyncState("idle");
    setLastSaved(null);
    localStorage.removeItem(LS_KEY_CSV);
    localStorage.removeItem(LS_KEY_NAME);
    // Clear from Supabase too
    await fetch("/api/shared", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ key: SHARED_KEY, value: {} }),
    });
  }

  return (
    <div className="space-y-6">
      {/* Temporary notice */}
      <div className="flex items-start gap-3 rounded-lg border border-yellow-800/50 bg-yellow-950/20 px-4 py-3 text-sm">
        <Clock size={15} className="mt-0.5 shrink-0 text-yellow-500" />
        <span className="text-yellow-300">
          <span className="font-medium">Temporary:</span> CSV upload is a manual step until the Amex API integration is live.
          Export from <span className="font-mono text-yellow-200">amex.com → Statement &amp; Activity → Download → CSV</span>.
        </span>
      </div>

      {/* Sync status */}
      {syncState === "saving" && (
        <div className="flex items-center gap-2 text-xs text-neutral-400">
          <Cloud size={13} className="animate-pulse" /> Saving to shared storage…
        </div>
      )}
      {syncState === "saved" && lastSaved && (
        <div className="flex items-center gap-2 text-xs text-green-500">
          <Cloud size={13} /> Shared — teammates will see this CSV automatically.
          <span className="text-neutral-500">
            Last updated {new Date(lastSaved).toLocaleString()}
          </span>
        </div>
      )}
      {syncState === "error" && (
        <div className="flex items-center gap-2 text-xs text-red-400">
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
