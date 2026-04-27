"use client";
import { useCallback, useState } from "react";
import { Upload, FileText, X, Lock } from "lucide-react";
import { parseAmexCsv, type ParseResult } from "@/lib/amex-parser";

interface Props {
  onParsed: (result: ParseResult, fileName: string, rawText: string) => void;
  /** Returns true if the server accepted the PIN and cleared, false otherwise. */
  onClear: (pin: string) => Promise<boolean>;
  hasData: boolean;
  fileName?: string;
}

export function AmexCsvUploader({ onParsed, onClear, hasData, fileName }: Props) {
  const [dragging,  setDragging]  = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [showPin,   setShowPin]   = useState(false);
  const [pin,       setPin]       = useState("");
  const [pinError,  setPinError]  = useState(false);
  const [verifying, setVerifying] = useState(false);

  const process = useCallback(
    (file: File) => {
      if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
        setError("Please upload a .csv file exported from amex.com");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const result = parseAmexCsv(text);
        if (result.rows.length === 0) {
          setError("No transactions found. Make sure you exported a Statement Activity CSV from amex.com.");
          return;
        }
        setError(null);
        onParsed(result, file.name, text);
      };
      reader.readAsText(file);
    },
    [onParsed],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) process(file);
    },
    [process],
  );

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) process(file);
    e.target.value = "";
  };

  function handleClearClick() { setPin(""); setPinError(false); setShowPin(true); }

  async function handlePinConfirm() {
    if (verifying) return;
    setVerifying(true);
    const ok = await onClear(pin);
    setVerifying(false);
    if (ok) { setShowPin(false); setPin(""); }
    else    { setPinError(true); setPin(""); }
  }

  function handlePinCancel() { setShowPin(false); setPin(""); setPinError(false); }

  /* ── loaded state ── */
  if (hasData && fileName) {
    return (
      <>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          border: "1px solid var(--line)", borderRadius: "var(--r-md)",
          background: "var(--panel)", padding: "10px 16px",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
            <FileText size={15} style={{ color: "var(--accent)", flexShrink: 0 }} />
            <span style={{ fontWeight: 500, color: "var(--ink)" }}>{fileName}</span>
            <span style={{ color: "var(--ink-4)" }}>loaded</span>
          </div>
          <button
            onClick={handleClearClick}
            style={{
              display: "flex", alignItems: "center", gap: 4,
              border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
              background: "transparent", color: "var(--ink-3)",
              padding: "4px 10px", fontSize: 12, cursor: "pointer",
            }}
          >
            <X size={12} /> Clear
          </button>
        </div>

        {/* PIN modal */}
        {showPin && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 50,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "rgba(12,10,9,.45)", backdropFilter: "blur(4px)",
          }}>
            <div style={{
              width: 320, borderRadius: "var(--r-lg)",
              border: "1px solid var(--line)", background: "var(--panel)",
              padding: 28, boxShadow: "0 24px 48px rgba(0,0,0,.12)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <Lock size={15} style={{ color: "var(--ink-3)" }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>Enter PIN to clear</span>
              </div>
              <p style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 16, lineHeight: 1.5 }}>
                This will remove the shared CSV for all teammates. Enter your PIN to confirm.
              </p>
              <input
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={pin}
                autoFocus
                onChange={(e) => { setPin(e.target.value); setPinError(false); }}
                onKeyDown={(e) => { if (e.key === "Enter") handlePinConfirm(); if (e.key === "Escape") handlePinCancel(); }}
                placeholder="••••"
                style={{
                  width: "100%", boxSizing: "border-box",
                  border: `1px solid ${pinError ? "var(--danger)" : "var(--line)"}`,
                  borderRadius: "var(--r-sm)", background: "var(--panel-2)",
                  color: "var(--ink)", padding: "8px 12px",
                  fontSize: 20, letterSpacing: "0.3em", textAlign: "center",
                  outline: "none",
                }}
              />
              {pinError && (
                <p style={{ marginTop: 8, textAlign: "center", fontSize: 12, color: "var(--danger)" }}>
                  Incorrect PIN
                </p>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button
                  onClick={handlePinCancel}
                  style={{
                    flex: 1, border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
                    background: "transparent", color: "var(--ink-3)",
                    padding: "8px 0", fontSize: 13, cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinConfirm}
                  disabled={verifying}
                  style={{
                    flex: 1, border: "1px solid #FECACA", borderRadius: "var(--r-sm)",
                    background: "#FEF2F2", color: "#DC2626",
                    padding: "8px 0", fontSize: 13, fontWeight: 500,
                    cursor: verifying ? "default" : "pointer",
                    opacity: verifying ? 0.6 : 1,
                  }}
                >
                  {verifying ? "Verifying…" : "Clear"}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  /* ── upload drop zone ── */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label
        style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", cursor: "pointer", textAlign: "center",
          borderRadius: "var(--r-md)", padding: "36px 24px",
          border: `2px dashed ${dragging ? "var(--accent)" : "var(--line)"}`,
          background: dragging ? "rgba(4,120,87,.04)" : "var(--panel)",
          transition: "border-color .15s, background .15s",
        }}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload size={26} style={{ marginBottom: 10, color: "var(--ink-4)" }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>
          Drop your Amex CSV here
        </div>
        <div style={{ marginTop: 4, fontSize: 12, color: "var(--ink-4)" }}>
          or click to browse · exported from amex.com → Statement &amp; Activity → Download
        </div>
        <input type="file" accept=".csv,text/csv" style={{ display: "none" }} onChange={onFileChange} />
      </label>
      {error && (
        <p style={{ fontSize: 12, color: "var(--danger)" }}>{error}</p>
      )}
    </div>
  );
}
