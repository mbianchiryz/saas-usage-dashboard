"use client";
import { useState, useEffect } from "react";
import { AmexCsvUploader } from "@/components/AmexCsvUploader";
import { AmexCsvAnalysis } from "@/components/AmexCsvAnalysis";
import { parseAmexCsv, type ParseResult } from "@/lib/amex-parser";
import { Clock } from "lucide-react";

const LS_KEY_CSV = "amex_csv_text";
const LS_KEY_NAME = "amex_csv_filename";

export function AmexClientSection() {
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [fileName, setFileName] = useState<string | undefined>();

  // Restore from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY_CSV);
    const savedName = localStorage.getItem(LS_KEY_NAME);
    if (saved && savedName) {
      const result = parseAmexCsv(saved);
      if (result.rows.length > 0) {
        setParseResult(result);
        setFileName(savedName);
      }
    }
  }, []);

  function handleParsed(result: ParseResult, name: string, rawText: string) {
    setParseResult(result);
    setFileName(name);
    localStorage.setItem(LS_KEY_CSV, rawText);
    localStorage.setItem(LS_KEY_NAME, name);
  }

  function handleClear() {
    setParseResult(null);
    setFileName(undefined);
    localStorage.removeItem(LS_KEY_CSV);
    localStorage.removeItem(LS_KEY_NAME);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-lg border border-yellow-800/50 bg-yellow-950/20 px-4 py-3 text-sm">
        <Clock size={15} className="mt-0.5 shrink-0 text-yellow-500" />
        <span className="text-yellow-300">
          <span className="font-medium">Temporary:</span> CSV upload is a manual step until the Amex API integration is live.
          Export from <span className="font-mono text-yellow-200">amex.com → Statement &amp; Activity → Download → CSV</span>.
        </span>
      </div>

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
