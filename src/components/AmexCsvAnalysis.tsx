"use client";
import { useState, useMemo } from "react";
import type { ParseResult, AmexRow } from "@/lib/amex-parser";
import { Card } from "@/components/Card";
import { fmtUSD } from "@/lib/format";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";
import clsx from "clsx";

const PROVIDER_COLOR: Record<string, string> = {
  anthropic: "#D97757",
  openai:    "#10A37F",
};

type CompareMode = "mom" | "pop";

function dailySeries(rows: AmexRow[]) {
  const byDate = new Map<string, { anthropic: number; openai: number }>();
  for (const r of rows) {
    if (!r.provider) continue;
    const entry = byDate.get(r.date) ?? { anthropic: 0, openai: 0 };
    entry[r.provider] += r.amount;
    byDate.set(r.date, entry);
  }
  return Array.from(byDate.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({
      date: date.slice(5),
      anthropic: Number(v.anthropic.toFixed(2)),
      openai:    Number(v.openai.toFixed(2)),
    }));
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString("en-US", { month: "long", year: "numeric" });
}

function shortMonth(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString("en-US", { month: "short", year: "2-digit" });
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}`;
}

function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

function daysWithData(rows: AmexRow[], ym: string): number {
  const days = new Set(rows.filter((r) => r.date.startsWith(ym)).map((r) => r.date));
  return Math.max(days.size, 1);
}

interface DeltaBadgeProps {
  current: number;
  prev: number;
}
function DeltaBadge({ current, prev }: DeltaBadgeProps) {
  if (prev === 0) return null;
  const delta = current - prev;
  const pct   = (delta / prev) * 100;
  const up    = delta > 0;
  return (
    <span className={clsx("text-xs font-medium", up ? "text-red-400" : "text-green-400")}>
      {up ? "▲" : "▼"} {fmtUSD(Math.abs(delta))} ({Math.abs(pct).toFixed(1)}%)
    </span>
  );
}

interface StatCardWithDeltaProps {
  label: string;
  value: string;
  sub?: React.ReactNode;
  delta?: React.ReactNode;
  accent?: "anthropic" | "openai" | "neutral";
}
function StatCardWithDelta({ label, value, sub, delta, accent }: StatCardWithDeltaProps) {
  const bar = {
    anthropic: "bg-brand-anthropic",
    openai:    "bg-brand-openai",
    neutral:   "bg-neutral-600",
  }[accent ?? "neutral"];
  return (
    <div className="relative overflow-hidden rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <div className={clsx("absolute left-0 top-0 h-full w-1", bar)} />
      <div className="pl-2">
        <div className="text-xs uppercase tracking-wide text-neutral-400">{label}</div>
        <div className="mt-1 text-3xl font-semibold">{value}</div>
        {delta && <div className="mt-1">{delta}</div>}
        {sub   && <div className="mt-1 text-xs text-neutral-500">{sub}</div>}
      </div>
    </div>
  );
}

export function AmexCsvAnalysis({ result }: { result: ParseResult }) {
  const allMatched = useMemo(() => result.rows.filter((r) => r.provider !== null), [result]);

  const availableMonths = useMemo(() => {
    const months = new Set(allMatched.map((r) => r.date.slice(0, 7)));
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [allMatched]);

  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [compareMode,   setCompareMode]   = useState<CompareMode>("pop");

  const matched = useMemo(
    () => selectedMonth === "all"
      ? allMatched
      : allMatched.filter((r) => r.date.startsWith(selectedMonth)),
    [allMatched, selectedMonth],
  );

  // Previous month rows (only relevant when a specific month is selected)
  const prev    = useMemo(() => prevMonth(selectedMonth), [selectedMonth]);
  const prevRows = useMemo(
    () => selectedMonth === "all" ? [] : allMatched.filter((r) => r.date.startsWith(prev)),
    [allMatched, prev, selectedMonth],
  );

  // Current month totals
  const anthropicTotal = matched.filter((r) => r.provider === "anthropic").reduce((s, r) => s + r.amount, 0);
  const openaiTotal    = matched.filter((r) => r.provider === "openai").reduce((s, r) => s + r.amount, 0);
  const grandTotal     = anthropicTotal + openaiTotal;

  // Previous month totals — adjusted for comparison mode
  const prevAnthropicRaw = prevRows.filter((r) => r.provider === "anthropic").reduce((s, r) => s + r.amount, 0);
  const prevOpenaiRaw    = prevRows.filter((r) => r.provider === "openai").reduce((s, r) => s + r.amount, 0);
  const prevTotalRaw     = prevAnthropicRaw + prevOpenaiRaw;

  // PoP: normalize prev month to same number of days as current month has data
  const currentDays = selectedMonth !== "all" ? daysWithData(allMatched, selectedMonth) : 1;
  const prevDays    = selectedMonth !== "all" ? daysInMonth(prev) : 1;
  const popFactor   = prevDays > 0 ? currentDays / prevDays : 1;

  const prevAnthropic = compareMode === "pop" ? prevAnthropicRaw * popFactor : prevAnthropicRaw;
  const prevOpenai    = compareMode === "pop" ? prevOpenaiRaw    * popFactor : prevOpenaiRaw;
  const prevTotal     = compareMode === "pop" ? prevTotalRaw     * popFactor : prevTotalRaw;

  const showDelta = selectedMonth !== "all" && prevRows.length > 0;
  const prevLabel = showDelta
    ? compareMode === "pop"
      ? `vs ${shortMonth(prev)} pace (${currentDays}d)`
      : `vs ${shortMonth(prev)} full month`
    : undefined;

  const series = dailySeries(matched);

  return (
    <div className="space-y-6">

      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Month selector */}
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-400">Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-white focus:border-neutral-500 focus:outline-none"
          >
            <option value="all">All months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          {selectedMonth !== "all" && (
            <button onClick={() => setSelectedMonth("all")} className="text-xs text-neutral-500 hover:text-white transition">
              Clear
            </button>
          )}
        </div>

        {/* MoM / PoP toggle — only when a month is selected */}
        {selectedMonth !== "all" && (
          <div className="flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 p-0.5">
            <button
              onClick={() => setCompareMode("mom")}
              className={clsx(
                "rounded px-3 py-1 text-xs font-medium transition",
                compareMode === "mom" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white",
              )}
            >
              MoM
            </button>
            <button
              onClick={() => setCompareMode("pop")}
              className={clsx(
                "rounded px-3 py-1 text-xs font-medium transition",
                compareMode === "pop" ? "bg-neutral-700 text-white" : "text-neutral-400 hover:text-white",
              )}
            >
              PoP
            </button>
          </div>
        )}

        {/* Mode explanation */}
        {selectedMonth !== "all" && (
          <span className="text-xs text-neutral-500">
            {compareMode === "mom"
              ? "Comparing full months"
              : `Comparing ${currentDays} days of each month (pace-normalized)`}
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCardWithDelta
          label={selectedMonth === "all" ? "Total matched" : `Total · ${monthLabel(selectedMonth)}`}
          value={fmtUSD(grandTotal)}
          delta={showDelta ? <DeltaBadge current={grandTotal} prev={prevTotal} /> : undefined}
          sub={<>{matched.length} transactions · {prevLabel}</>}
          accent="neutral"
        />
        <StatCardWithDelta
          label="Anthropic"
          value={fmtUSD(anthropicTotal)}
          delta={showDelta ? <DeltaBadge current={anthropicTotal} prev={prevAnthropic} /> : undefined}
          sub={<>{matched.filter((r) => r.provider === "anthropic").length} transactions</>}
          accent="anthropic"
        />
        <StatCardWithDelta
          label="OpenAI"
          value={fmtUSD(openaiTotal)}
          delta={showDelta ? <DeltaBadge current={openaiTotal} prev={prevOpenai} /> : undefined}
          sub={<>{matched.filter((r) => r.provider === "openai").length} transactions</>}
          accent="openai"
        />
      </div>

      {/* Daily burn chart */}
      {series.length > 1 && (
        <Card>
          <h3 className="mb-4 text-base font-medium">Daily burn</h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#262626" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#6b7280" fontSize={11} />
                <YAxis stroke="#6b7280" fontSize={11} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{ background: "#171717", border: "1px solid #262626", borderRadius: 6 }}
                  labelStyle={{ color: "#a3a3a3" }}
                  formatter={(v: number, n: string) => [fmtUSD(v), n]}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="anthropic" name="Anthropic" stroke="#D97757" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                <Line type="monotone" dataKey="openai"    name="OpenAI"    stroke="#10A37F" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Matched charges table */}
      {matched.length > 0 && (
        <Card>
          <h3 className="mb-4 text-base font-medium">Matched charges</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-400">
                <th className="py-3 pr-4">Date</th>
                <th className="py-3 pr-4">Description</th>
                <th className="py-3 pr-4">Provider</th>
                <th className="py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {matched.map((r, i) => (
                <tr key={i} className="border-b border-neutral-900 last:border-0">
                  <td className="py-3 pr-4 font-mono text-xs text-neutral-400">{r.date}</td>
                  <td className="py-3 pr-4">{r.description}</td>
                  <td className="py-3 pr-4">
                    <span
                      className="inline-block rounded px-2 py-0.5 text-xs capitalize"
                      style={{ background: `${PROVIDER_COLOR[r.provider!]}22`, color: PROVIDER_COLOR[r.provider!] }}
                    >
                      {r.provider}
                    </span>
                  </td>
                  <td className="py-3 text-right tabular-nums font-medium">{fmtUSD(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {matched.length === 0 && (
        <Card>
          <p className="text-sm text-neutral-400">
            No charges found for {selectedMonth === "all" ? "this file" : monthLabel(selectedMonth)}.
          </p>
        </Card>
      )}
    </div>
  );
}
