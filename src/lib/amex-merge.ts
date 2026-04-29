import type { AmexRow } from "./amex-parser";

/**
 * Stable signature for an Amex row. Amex CSVs don't expose a transaction id,
 * but date + amount + (normalised) description is unique enough in practice.
 */
export function rowSignature(r: AmexRow): string {
  const desc = r.description.trim().replace(/\s+/g, " ").toLowerCase();
  return `${r.date}|${r.amount.toFixed(2)}|${desc}`;
}

export interface MergeResult {
  merged:     AmexRow[];
  added:      number;
  duplicates: number;
}

/** Append `incoming` to `existing`, dropping duplicates by signature. */
export function mergeRows(existing: AmexRow[], incoming: AmexRow[]): MergeResult {
  const seen = new Set(existing.map(rowSignature));
  const merged: AmexRow[] = [...existing];
  let added = 0;
  let duplicates = 0;
  for (const r of incoming) {
    const sig = rowSignature(r);
    if (seen.has(sig)) { duplicates++; continue; }
    seen.add(sig);
    merged.push(r);
    added++;
  }
  // Sort newest-first by date for stable display
  merged.sort((a, b) => b.date.localeCompare(a.date));
  return { merged, added, duplicates };
}

export interface UploadEvent {
  fileName:   string;
  uploadedAt: string;        // ISO
  total:      number;        // rows in this upload
  added:      number;
  duplicates: number;
}

export interface AmexStore {
  rows:    AmexRow[];
  history: UploadEvent[];
}

/** Coerce whatever's stored in Supabase (old `csvText` shape or new `rows`) into AmexStore. */
export function normaliseStore(value: unknown, parseFn: (s: string) => { rows: AmexRow[] }): AmexStore {
  if (value == null || typeof value !== "object") return { rows: [], history: [] };
  const v = value as { rows?: unknown; history?: unknown; csvText?: string; fileName?: string };
  if (Array.isArray(v.rows)) {
    return {
      rows:    v.rows as AmexRow[],
      history: Array.isArray(v.history) ? (v.history as UploadEvent[]) : [],
    };
  }
  // Backward-compat: old shape had a single csvText blob.
  if (typeof v.csvText === "string" && v.csvText.length > 0) {
    const { rows } = parseFn(v.csvText);
    return {
      rows,
      history: [{
        fileName:   v.fileName ?? "imported.csv",
        uploadedAt: new Date().toISOString(),
        total:      rows.length,
        added:      rows.length,
        duplicates: 0,
      }],
    };
  }
  return { rows: [], history: [] };
}
