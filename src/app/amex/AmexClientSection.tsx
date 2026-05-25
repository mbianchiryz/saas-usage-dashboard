"use client";
import { useState, useEffect } from "react";
import { AmexCsvUploader } from "@/components/AmexCsvUploader";
import { AmexCsvAnalysis } from "@/components/AmexCsvAnalysis";
import { parseAmexCsv, type ParseResult, type AmexRow } from "@/lib/amex-parser";
import { mergeRows, normaliseStore, type AmexStore, type UploadEvent } from "@/lib/amex-merge";
import { Cloud, CloudOff, Clock, FileText, Trash2 } from "lucide-react";

const SHARED_KEY    = "amex_csv";
const LS_KEY_STORE  = "amex_store_v2";

type SyncState = "idle" | "saving" | "saved" | "error";

interface MergeSummary {
  fileName:   string;
  added:      number;
  duplicates: number;
}

function rowsToParseResult(rows: AmexRow[]): ParseResult {
  return { rows, skipped: 0, format: "merged" };
}

export function AmexClientSection() {
  const [store,        setStore]        = useState<AmexStore>({ rows: [], history: [] });
  const [syncState,    setSyncState]    = useState<SyncState>("idle");
  const [lastSaved,    setLastSaved]    = useState<string | null>(null);
  const [lastMerge,    setLastMerge]    = useState<MergeSummary | null>(null);

  /* Load: Supabase first, localStorage fallback. */
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/shared?key=${SHARED_KEY}`);
        const json = await res.json();
        if (json.data) {
          const s = normaliseStore(json.data, parseAmexCsv);
          if (s.rows.length > 0) {
            setStore(s);
            setLastSaved(json.updated_at ?? null);
            localStorage.setItem(LS_KEY_STORE, JSON.stringify(s));
            return;
          }
        }
      } catch { /* fallback */ }
      const saved = localStorage.getItem(LS_KEY_STORE);
      if (saved) {
        try {
          const s = JSON.parse(saved) as AmexStore;
          if (Array.isArray(s.rows) && s.rows.length > 0) { setStore(s); return; }
        } catch { /* ignore */ }
      }
      /* One-shot migration from the old single-CSV localStorage format. */
      const oldCsv  = localStorage.getItem("amex_csv_text");
      const oldName = localStorage.getItem("amex_csv_filename");
      if (oldCsv) {
        const { rows } = parseAmexCsv(oldCsv);
        if (rows.length > 0) {
          const migrated: AmexStore = {
            rows,
            history: [{
              fileName:   oldName ?? "imported.csv",
              uploadedAt: new Date().toISOString(),
              total:      rows.length,
              added:      rows.length,
              duplicates: 0,
            }],
          };
          setStore(migrated);
          localStorage.setItem(LS_KEY_STORE, JSON.stringify(migrated));
        }
      }
    }
    load();
  }, []);

  async function persist(next: AmexStore) {
    setStore(next);
    localStorage.setItem(LS_KEY_STORE, JSON.stringify(next));
    setSyncState("saving");
    try {
      const res = await fetch("/api/shared", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: SHARED_KEY, value: next }),
      });
      if (res.ok) { setSyncState("saved"); setLastSaved(new Date().toISOString()); }
      else          setSyncState("error");
    } catch { setSyncState("error"); }
  }

  async function handleParsed(result: ParseResult, name: string) {
    const uploadId = new Date().toISOString();
    const { merged, added, duplicates } = mergeRows(store.rows, result.rows, uploadId);
    const event: UploadEvent = {
      fileName:   name,
      uploadedAt: uploadId,
      total:      result.rows.length,
      added,
      duplicates,
    };
    const next: AmexStore = { rows: merged, history: [event, ...store.history].slice(0, 20) };
    setLastMerge({ fileName: name, added, duplicates });
    await persist(next);
  }

  async function handleDeleteUpload(uploadedAt: string) {
    const next: AmexStore = {
      rows:    store.rows.filter(r => r._uploadId !== uploadedAt),
      history: store.history.filter(h => h.uploadedAt !== uploadedAt),
    };
    setLastMerge(null);
    await persist(next);
  }

  async function handleClear(pin: string): Promise<boolean> {
    const res = await fetch("/api/shared", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: SHARED_KEY, value: {}, pin }),
    });
    if (!res.ok) return false;
    setStore({ rows: [], history: [] });
    setLastMerge(null);
    setSyncState("idle"); setLastSaved(null);
    localStorage.removeItem(LS_KEY_STORE);
    return true;
  }

  const hasData = store.rows.length > 0;
  const lastFileName = store.history[0]?.fileName;
  const parseResult: ParseResult | null = hasData ? rowsToParseResult(store.rows) : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "12px 16px", borderRadius: "var(--r-md)",
        border: "1px solid #FDE68A", background: "#FFFBEB",
        fontSize: 13, color: "#92400E",
      }}>
        <Clock size={14} style={{ marginTop: 1, flexShrink: 0, color: "#D97706" }} />
        <span>
          <strong>Multi-card support:</strong> each upload appends to the shared store — upload Gold
          and Platinum statements separately each month. Duplicate rows across cards are detected
          automatically. Use the <strong>🗑</strong> button in the history to remove a specific upload.
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

      {/* Last-merge summary banner */}
      {lastMerge && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 14px", border: "1px solid var(--accent-soft, #BBF7D0)",
          background: "var(--accent-soft, #ECFDF5)",
          borderRadius: "var(--r-md)", fontSize: 13, color: "var(--accent)",
        }}>
          <FileText size={14} />
          <span>
            <strong>{lastMerge.fileName}</strong>: {lastMerge.added} new row{lastMerge.added === 1 ? "" : "s"} added
            {lastMerge.duplicates > 0 && <> · {lastMerge.duplicates} duplicate{lastMerge.duplicates === 1 ? "" : "s"} skipped</>}.
          </span>
        </div>
      )}

      <AmexCsvUploader
        onParsed={(result, name) => handleParsed(result, name)}
        onClear={handleClear}
        hasData={hasData}
        fileName={lastFileName}
      />

      {/* Upload history */}
      {store.history.length > 0 && (
        <details open style={{ fontSize: 12, color: "var(--ink-3)" }}>
          <summary style={{ cursor: "pointer", padding: "4px 0", color: "var(--ink-3)" }}>
            Upload history · {store.history.length} upload{store.history.length === 1 ? "" : "s"} · {store.rows.length} total rows
          </summary>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                <th style={thHist}>When</th>
                <th style={thHist}>File</th>
                <th style={{ ...thHist, textAlign: "right" }}>Rows</th>
                <th style={{ ...thHist, textAlign: "right" }}>Added</th>
                <th style={{ ...thHist, textAlign: "right" }}>Duplicates</th>
                <th style={{ ...thHist, textAlign: "center" }}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {store.history.map((h, i) => {
                const canDelete = store.rows.some(r => r._uploadId === h.uploadedAt);
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={tdHist}>{new Date(h.uploadedAt).toLocaleString()}</td>
                    <td style={tdHist}>{h.fileName}</td>
                    <td style={{ ...tdHist, textAlign: "right" }}>{h.total}</td>
                    <td style={{ ...tdHist, textAlign: "right", color: "var(--accent)" }}>{h.added}</td>
                    <td style={{ ...tdHist, textAlign: "right", color: "var(--ink-4)" }}>{h.duplicates}</td>
                    <td style={{ ...tdHist, textAlign: "center" }}>
                      {canDelete ? (
                        <button
                          onClick={() => handleDeleteUpload(h.uploadedAt)}
                          title={`Remove rows from ${h.fileName}`}
                          style={{
                            background: "none", border: "none", cursor: "pointer",
                            color: "var(--danger)", padding: "2px 6px", borderRadius: "var(--r-sm)",
                            display: "inline-flex", alignItems: "center",
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <span style={{ color: "var(--ink-4)", fontSize: 10 }}>legacy</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </details>
      )}

      {parseResult && <AmexCsvAnalysis result={parseResult} />}
    </div>
  );
}

const thHist: React.CSSProperties = {
  padding: "6px 10px", textAlign: "left",
  fontSize: 10, fontWeight: 500, letterSpacing: ".04em", textTransform: "uppercase",
  color: "var(--ink-4)",
};
const tdHist: React.CSSProperties = {
  padding: "6px 10px", fontSize: 12, color: "var(--ink-2)",
};
