"use client";
import { useCallback, useState } from "react";
import { Upload, FileText, X, Lock } from "lucide-react";
import { parseAmexCsv, type ParseResult } from "@/lib/amex-parser";
import clsx from "clsx";

const CLEAR_PIN = "1234";

interface Props {
  onParsed: (result: ParseResult, fileName: string, rawText: string) => void;
  onClear: () => void;
  hasData: boolean;
  fileName?: string;
}

export function AmexCsvUploader({ onParsed, onClear, hasData, fileName }: Props) {
  const [dragging,    setDragging]    = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [showPin,     setShowPin]     = useState(false);
  const [pin,         setPin]         = useState("");
  const [pinError,    setPinError]    = useState(false);

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

  function handleClearClick() {
    setPin("");
    setPinError(false);
    setShowPin(true);
  }

  function handlePinConfirm() {
    if (pin === CLEAR_PIN) {
      setShowPin(false);
      setPin("");
      onClear();
    } else {
      setPinError(true);
      setPin("");
    }
  }

  function handlePinCancel() {
    setShowPin(false);
    setPin("");
    setPinError(false);
  }

  if (hasData && fileName) {
    return (
      <>
        <div className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3">
          <div className="flex items-center gap-3 text-sm">
            <FileText size={16} className="text-brand-amex" />
            <span className="text-white">{fileName}</span>
            <span className="text-neutral-500">loaded</span>
          </div>
          <button
            onClick={handleClearClick}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
          >
            <X size={12} /> Clear
          </button>
        </div>

        {/* PIN modal */}
        {showPin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="w-80 rounded-xl border border-neutral-700 bg-neutral-900 p-6 shadow-2xl">
              <div className="mb-4 flex items-center gap-2">
                <Lock size={16} className="text-neutral-400" />
                <h3 className="text-sm font-medium">Enter PIN to clear</h3>
              </div>
              <p className="mb-4 text-xs text-neutral-500">
                This will remove the CSV for everyone. Enter your PIN to confirm.
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
                className={clsx(
                  "w-full rounded-md border bg-neutral-800 px-3 py-2 text-center text-lg tracking-widest text-white placeholder-neutral-600 focus:outline-none",
                  pinError ? "border-red-500" : "border-neutral-700 focus:border-neutral-500",
                )}
              />
              {pinError && (
                <p className="mt-2 text-center text-xs text-red-400">Incorrect PIN</p>
              )}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handlePinCancel}
                  className="flex-1 rounded-md border border-neutral-700 py-2 text-sm text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handlePinConfirm}
                  className="flex-1 rounded-md bg-red-900/60 py-2 text-sm text-red-300 hover:bg-red-900 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="space-y-2">
      <label
        className={clsx(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition",
          dragging
            ? "border-brand-amex bg-blue-950/20"
            : "border-neutral-700 hover:border-neutral-500 hover:bg-neutral-900",
        )}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
      >
        <Upload size={28} className="mb-3 text-neutral-500" />
        <div className="text-sm text-white">Drop your Amex CSV here</div>
        <div className="mt-1 text-xs text-neutral-500">
          or click to browse · exported from amex.com → Statement &amp; Activity → Download
        </div>
        <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFileChange} />
      </label>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
