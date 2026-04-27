"use client";
import { useState, useMemo } from "react";
import type { ParseResult, AmexRow } from "@/lib/amex-parser";
import { Card, StatCard } from "@/components/Card";
import { fmtUSD } from "@/lib/format";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend,
} from "recharts";

const PROVIDER_COLOR: Record<string, string> = {
  anthropic: "#D97757",
  openai: "#10A37F",
};

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
      date: date.slice(5), // MM-DD
      anthropic: Number(v.anthropic.toFixed(2)),
      openai: Number(v.openai.toFixed(2)),
    }));
}

function monthLabel(ym: string) {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export function AmexCsvAnalysis({ result }: { result: ParseResult }) {
  const allMatched = useMemo(() => result.rows.filter((r) => r.provider !== null), [result]);

  // Derive sorted list of available months from matched rows
  const availableMonths = useMemo(() => {
    const months = new Set(allMatched.map((r) => r.date.slice(0, 7)));
    return Array.from(months).sort((a, b) => b.localeCompare(a)); // newest first
  }, [allMatched]);

  const [selectedMonth, setSelectedMonth] = useState<string>("all");

  // Filter rows based on selected month
  const matched = useMemo(
    () =>
      selectedMonth === "all"
        ? allMatched
        : allMatched.filter((r) => r.date.startsWith(selectedMonth)),
    [allMatched, selectedMonth],
  );

  const anthropicRows = matched.filter((r) => r.provider === "anthropic");
  const openaiRows = matched.filter((r) => r.provider === "openai");
  const anthropicTotal = anthropicRows.reduce((s, r) => s + r.amount, 0);
  const openaiTotal = openaiRows.reduce((s, r) => s + r.amount, 0);
  const grandTotal = anthropicTotal + openaiTotal;

  const series = dailySeries(matched);

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center gap-3">
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
          <button
            onClick={() => setSelectedMonth("all")}
            className="text-xs text-neutral-500 hover:text-white transition"
          >
            Clear
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard
          label={selectedMonth === "all" ? "Total matched" : `Total · ${monthLabel(selectedMonth)}`}
          value={fmtUSD(grandTotal)}
          sub={`${matched.length} transactions · ${result.rows.length} total in file`}
          accent="neutral"
        />
        <StatCard
          label="Anthropic"
          value={fmtUSD(anthropicTotal)}
          sub={`${anthropicRows.length} transactions`}
          accent="anthropic"
        />
        <StatCard
          label="OpenAI"
          value={fmtUSD(openaiTotal)}
          sub={`${openaiRows.length} transactions`}
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
                <Line type="monotone" dataKey="openai" name="OpenAI" stroke="#10A37F" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
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
