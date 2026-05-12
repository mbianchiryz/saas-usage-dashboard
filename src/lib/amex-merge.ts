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

/** Append `incoming` to `existing`, dropping duplicates by signature.
 *
 * Deduplication is COUNT-AWARE: if the same (date|amount|description)
 * signature appears N times in the existing store and M times in the
 * incoming file, we add max(0, M - N) new rows.  This preserves
 * legitimately-repeated charges (e.g. two API invoices on the same day
 * for the same amount) while still preventing re-uploads of the same
 * CSV from inflating the totals.
 */
export function mergeRows(existing: AmexRow[], incoming: AmexRow[]): MergeResult {
  // Count how many times each signature already exists in the store.
  const existingCounts = new Map<string, number>();
  for (const r of existing) {
    const sig = rowSignature(r);
    existingCounts.set(sig, (existingCounts.get(sig) ?? 0) + 1);
  }

  // Track how many of each signature we've seen while iterating incoming.
  const incomingCounts = new Map<string, number>();

  const merged: AmexRow[] = [...existing];
  let added = 0;
  let duplicates = 0;

  for (const r of incoming) {
    const sig = rowSignature(r);
    const nth = (incomingCounts.get(sig) ?? 0) + 1;
    incomingCounts.set(sig, nth);

    // Only add this occurrence if it exceeds what we already stored.
    if (nth <= (existingCounts.get(sig) ?? 0)) {
      duplicates++;
      continue;
    }

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
