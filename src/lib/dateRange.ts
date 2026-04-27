/**
 * Shared date-range utilities.
 *
 * The dashboard has a global date range picker. The selected range is encoded in
 * the URL via `?from=YYYY-MM-DD&to=YYYY-MM-DD&preset=<preset>` so links are shareable.
 * Server components read the range via `searchParams`; the client picker writes it via
 * `router.push`.
 */

import { todayStr } from "./metrics";

export type Preset = "7d" | "30d" | "mtd" | "last-month" | "qtd" | "ytd" | "custom";

export interface DateRange {
  from: string;     // YYYY-MM-DD inclusive
  to:   string;     // YYYY-MM-DD inclusive
  preset: Preset;
  label: string;    // human-readable
}

const PRESET_LABELS: Record<Preset, string> = {
  "7d":         "Last 7 days",
  "30d":        "Last 30 days",
  "mtd":        "Month to date",
  "last-month": "Last month",
  "qtd":        "Quarter to date",
  "ytd":        "Year to date",
  "custom":     "Custom range",
};

export const PRESET_OPTIONS: Array<{ value: Preset; label: string }> = [
  { value: "7d",         label: PRESET_LABELS["7d"] },
  { value: "30d",        label: PRESET_LABELS["30d"] },
  { value: "mtd",        label: PRESET_LABELS["mtd"] },
  { value: "last-month", label: PRESET_LABELS["last-month"] },
  { value: "qtd",        label: PRESET_LABELS["qtd"] },
  { value: "ytd",        label: PRESET_LABELS["ytd"] },
];

function pad(n: number): string { return String(n).padStart(2, "0"); }
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Compute the {from,to} dates for a given preset, anchored on the live today. */
export function presetRange(preset: Preset, todayISO = todayStr()): { from: string; to: string } {
  const today = new Date(todayISO + "T00:00:00");
  const y = today.getFullYear();
  const m = today.getMonth();          // 0-indexed
  const d = today.getDate();

  switch (preset) {
    case "7d": {
      const from = new Date(today); from.setDate(d - 6);
      return { from: isoDate(from), to: todayISO };
    }
    case "30d": {
      const from = new Date(today); from.setDate(d - 29);
      return { from: isoDate(from), to: todayISO };
    }
    case "mtd":
      return { from: `${y}-${pad(m + 1)}-01`, to: todayISO };
    case "last-month": {
      const lastMonth = m === 0 ? 12 : m;
      const lastY     = m === 0 ? y - 1 : y;
      const lastDay   = new Date(lastY, lastMonth, 0).getDate();
      return { from: `${lastY}-${pad(lastMonth)}-01`, to: `${lastY}-${pad(lastMonth)}-${pad(lastDay)}` };
    }
    case "qtd": {
      const qStartMonth = Math.floor(m / 3) * 3;
      return { from: `${y}-${pad(qStartMonth + 1)}-01`, to: todayISO };
    }
    case "ytd":
      return { from: `${y}-01-01`, to: todayISO };
    case "custom":
      return { from: todayISO, to: todayISO };
  }
}

/** Parse a date range out of search params. Falls back to MTD. */
export function parseRange(searchParams: Record<string, string | string[] | undefined> | URLSearchParams): DateRange {
  const get = (k: string): string | undefined => {
    if (searchParams instanceof URLSearchParams) return searchParams.get(k) ?? undefined;
    const v = searchParams[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const fromParam = get("from");
  const toParam   = get("to");
  const presetRaw = get("preset") as Preset | undefined;

  const validIso = /^\d{4}-\d{2}-\d{2}$/;

  // Preset wins unless explicit dates are provided
  if (presetRaw && presetRaw !== "custom" && PRESET_LABELS[presetRaw]) {
    const r = presetRange(presetRaw);
    return { ...r, preset: presetRaw, label: PRESET_LABELS[presetRaw] };
  }
  if (fromParam && toParam && validIso.test(fromParam) && validIso.test(toParam)) {
    return { from: fromParam, to: toParam, preset: "custom", label: `${fromParam} → ${toParam}` };
  }

  // Default
  const r = presetRange("mtd");
  return { ...r, preset: "mtd", label: PRESET_LABELS["mtd"] };
}

/** Filter a list of rows with a `date` field (YYYY-MM-DD) by an inclusive range. */
export function filterByRange<T extends { date: string }>(rows: T[], range: { from: string; to: string }): T[] {
  return rows.filter((r) => r.date >= range.from && r.date <= range.to);
}

/** Number of days the range spans (inclusive). */
export function rangeDays(range: { from: string; to: string }): number {
  const a = new Date(range.from + "T00:00:00").getTime();
  const b = new Date(range.to   + "T00:00:00").getTime();
  return Math.max(1, Math.round((b - a) / 86_400_000) + 1);
}

/** Compute the comparable previous-period range (same number of days, ending the day before `from`). */
export function previousRange(range: { from: string; to: string }): { from: string; to: string } {
  const days = rangeDays(range);
  const fromD = new Date(range.from + "T00:00:00");
  const prevTo   = new Date(fromD); prevTo.setDate(prevTo.getDate() - 1);
  const prevFrom = new Date(prevTo); prevFrom.setDate(prevFrom.getDate() - (days - 1));
  return { from: isoDate(prevFrom), to: isoDate(prevTo) };
}
