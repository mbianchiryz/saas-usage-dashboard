/**
 * Anomaly detection — flags days where a developer's spend is more than `threshold`
 * standard deviations above their own 30-day rolling mean.
 *
 * Standard z-score, restricted to "spend went up unusually". Quiet days (z < 0)
 * are not anomalies for our purpose (we care about cost spikes).
 */

import type { UsageDaily } from "./types";

export interface Anomaly {
  developerId: string;
  date:        string;
  spend:       number;
  mean:        number;
  stddev:      number;
  zScore:      number;
}

interface Args {
  /** Raw usage rows. Will be aggregated to per-developer-per-day totals. */
  rows: UsageDaily[];
  /** Map api_key_id -> developer_id (so we can roll up). */
  keyToDev: Map<string, string>;
  /** How many days of history to use as the baseline window. Default 30. */
  windowDays?: number;
  /** σ threshold above the rolling mean. Default 2 (≈ top 2.5% if normal). */
  threshold?: number;
  /** Minimum baseline spend mean to even consider a flag (filter out tiny-base noise). */
  minMean?: number;
}

export function detectAnomalies({
  rows, keyToDev, windowDays = 30, threshold = 2, minMean = 1,
}: Args): Anomaly[] {
  /* Aggregate spend per developer per day */
  const byDevDay = new Map<string, Map<string, number>>(); // devId -> (date -> spend)
  for (const u of rows) {
    const devId = keyToDev.get(u.api_key_id);
    if (!devId) continue;
    let inner = byDevDay.get(devId);
    if (!inner) { inner = new Map(); byDevDay.set(devId, inner); }
    inner.set(u.date, (inner.get(u.date) ?? 0) + u.cost_usd);
  }

  const anomalies: Anomaly[] = [];

  for (const [devId, daily] of byDevDay) {
    /* Sorted ascending by date */
    const series = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    for (let i = 0; i < series.length; i++) {
      const [date, spend] = series[i];

      /* Use up to `windowDays` of history *before* this day */
      const start = Math.max(0, i - windowDays);
      const baseline = series.slice(start, i).map(([, v]) => v);
      if (baseline.length < 7) continue; // need at least a week of history

      const mean = baseline.reduce((s, v) => s + v, 0) / baseline.length;
      if (mean < minMean) continue;

      const variance = baseline.reduce((s, v) => s + (v - mean) ** 2, 0) / baseline.length;
      const stddev   = Math.sqrt(variance);
      if (stddev === 0) continue;

      const z = (spend - mean) / stddev;
      if (z >= threshold) {
        anomalies.push({ developerId: devId, date, spend, mean, stddev, zScore: z });
      }
    }
  }

  /* Most severe first */
  return anomalies.sort((a, b) => b.zScore - a.zScore);
}

/** Filter to anomalies within a date range. */
export function anomaliesInRange(anomalies: Anomaly[], from: string, to: string): Anomaly[] {
  return anomalies.filter((a) => a.date >= from && a.date <= to);
}
