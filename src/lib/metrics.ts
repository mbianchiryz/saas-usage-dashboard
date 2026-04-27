import type { UsageDaily, Provider } from "./types";

const TODAY = "2026-04-24";

export function mtdRange(today = TODAY): { from: string; to: string } {
  return { from: today.slice(0, 7) + "-01", to: today };
}

export function prevMonthRange(today = TODAY): { from: string; to: string } {
  const [y, m] = today.slice(0, 7).split("-").map(Number);
  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  const mm = String(prevM).padStart(2, "0");
  const lastDay = new Date(prevY, prevM, 0).getDate();
  return { from: `${prevY}-${mm}-01`, to: `${prevY}-${mm}-${lastDay}` };
}

export function sumCost(rows: UsageDaily[], provider?: Provider) {
  return rows
    .filter((r) => !provider || r.provider === provider)
    .reduce((s, r) => s + r.cost_usd, 0);
}

export function projectMonthEnd(mtd: number, today = TODAY): number {
  const [y, m, d] = today.split("-").map(Number);
  const daysElapsed = d;
  const daysInMonth = new Date(y, m, 0).getDate();
  return (mtd / daysElapsed) * daysInMonth;
}

export function dailySeriesByProvider(rows: UsageDaily[]): Array<{ date: string; anthropic: number; openai: number }> {
  const byDate = new Map<string, { anthropic: number; openai: number }>();
  for (const r of rows) {
    const entry = byDate.get(r.date) ?? { anthropic: 0, openai: 0 };
    if (r.provider === "anthropic") entry.anthropic += r.cost_usd;
    if (r.provider === "openai") entry.openai += r.cost_usd;
    byDate.set(r.date, entry);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, anthropic: Number(v.anthropic.toFixed(2)), openai: Number(v.openai.toFixed(2)) }));
}
