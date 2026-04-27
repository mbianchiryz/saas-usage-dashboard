"use client";
import { useCallback, useState } from "react";
import { Upload, FileText, X } from "lucide-react";
import { parseAmexCsv, type ParseResult } from "@/lib/amex-parser";
import clsx from "clsx";

interface Props {
  onParsed: (result: ParseResult, fileName: string, rawText: string) => void;
  onClear: () => void;
  hasData: boolean;
  fileName?: string;
}

export function AmexCsvUploader({ onParsed, onClear, hasData, fileName }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  if (hasData && fileName) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-3">
        <div className="flex items-center gap-3 text-sm">
          <FileText size={16} className="text-brand-amex" />
          <span className="text-white">{fileName}</span>
          <span className="text-neutral-500">loaded</span>
        </div>
        <button
          onClick={onClear}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-800 hover:text-white transition"
        >
          <X size={12} /> Clear
        </button>
      </div>
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
