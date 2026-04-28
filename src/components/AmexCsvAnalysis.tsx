"use client";
import { useState, useMemo } from "react";
import type { ParseResult, AmexRow } from "@/lib/amex-parser";
import { Panel, SectionTitle, Metric, ProviderTag, Th, Td, Pill, PROVIDER_HEX } from "@/components/ui";
import { fmtUSD } from "@/lib/format";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, ReferenceLine,
} from "recharts";

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

function DeltaBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const delta = current - prev;
  const pct   = (delta / prev) * 100;
  const up    = delta > 0;
  return (
    <span style={{
      fontSize: 12, fontWeight: 500,
      color: up ? "var(--danger)" : "var(--accent)",
    }}>
      {up ? "▲" : "▼"} {fmtUSD(Math.abs(delta))} ({Math.abs(pct).toFixed(1)}%)
    </span>
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

  const prev     = useMemo(() => prevMonth(selectedMonth), [selectedMonth]);
  const prevRows = useMemo(
    () => selectedMonth === "all" ? [] : allMatched.filter((r) => r.date.startsWith(prev)),
    [allMatched, prev, selectedMonth],
  );

  const anthropicTotal = matched.filter((r) => r.provider === "anthropic").reduce((s, r) => s + r.amount, 0);
  const openaiTotal    = matched.filter((r) => r.provider === "openai").reduce((s, r) => s + r.amount, 0);
  const grandTotal     = anthropicTotal + openaiTotal;

  const prevAnthropicRaw = prevRows.filter((r) => r.provider === "anthropic").reduce((s, r) => s + r.amount, 0);
  const prevOpenaiRaw    = prevRows.filter((r) => r.provider === "openai").reduce((s, r) => s + r.amount, 0);
  const prevTotalRaw     = prevAnthropicRaw + prevOpenaiRaw;

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

  /* ── shared select/button styles ── */
  const selectStyle: React.CSSProperties = {
    borderRadius: "var(--r-sm)", border: "1px solid var(--line)",
    background: "var(--panel)", color: "var(--ink)",
    padding: "5px 10px", fontSize: 13, outline: "none",
  };

  const toggleBase: React.CSSProperties = {
    borderRadius: "var(--r-sm)", padding: "4px 10px",
    fontSize: 12, fontWeight: 500, cursor: "pointer",
    border: "none", transition: "background .15s, color .15s",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Controls row */}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
        {/* Month selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <label style={{ fontSize: 13, color: "var(--ink-3)" }}>Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={selectStyle}
          >
            <option value="all">All months</option>
            {availableMonths.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
          {selectedMonth !== "all" && (
            <button
              onClick={() => setSelectedMonth("all")}
              style={{ ...toggleBase, background: "transparent", color: "var(--ink-4)", fontSize: 12 }}
            >
              Clear
            </button>
          )}
        </div>

        {/* MoM / PoP toggle */}
        {selectedMonth !== "all" && (
          <div style={{
            display: "flex", alignItems: "center", gap: 2,
            border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
            background: "var(--panel-2)", padding: 2,
          }}>
            {(["mom", "pop"] as CompareMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setCompareMode(mode)}
                style={{
                  ...toggleBase,
                  background: compareMode === mode ? "var(--panel)" : "transparent",
                  color: compareMode === mode ? "var(--ink)" : "var(--ink-4)",
                  boxShadow: compareMode === mode ? "0 1px 2px rgba(0,0,0,.06)" : "none",
                }}
              >
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {/* Mode hint */}
        {selectedMonth !== "all" && (
          <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
            {compareMode === "mom"
              ? "Comparing full months"
              : `Pace-normalized · ${currentDays} days`}
          </span>
        )}
      </div>

      {/* Summary metrics */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        <Panel>
          <Metric
            label={selectedMonth === "all" ? "Total matched" : `Total · ${monthLabel(selectedMonth)}`}
            value={fmtUSD(grandTotal)}
            sub={`${matched.length} transactions${prevLabel ? ` · ${prevLabel}` : ""}`}
            delta={showDelta ? undefined : undefined}
          />
          {showDelta && <div style={{ marginTop: 6 }}><DeltaBadge current={grandTotal} prev={prevTotal} /></div>}
        </Panel>
        <Panel>
          <Metric
            label="Anthropic"
            value={fmtUSD(anthropicTotal)}
            sub={`${matched.filter((r) => r.provider === "anthropic").length} transactions`}
          />
          {showDelta && <div style={{ marginTop: 6 }}><DeltaBadge current={anthropicTotal} prev={prevAnthropic} /></div>}
        </Panel>
        <Panel>
          <Metric
            label="OpenAI"
            value={fmtUSD(openaiTotal)}
            sub={`${matched.filter((r) => r.provider === "openai").length} transactions`}
          />
          {showDelta && <div style={{ marginTop: 6 }}><DeltaBadge current={openaiTotal} prev={prevOpenai} /></div>}
        </Panel>
      </div>

      {/* Daily burn chart */}
      {series.length > 1 && (() => {
        const dailyAvg = grandTotal / series.length;
        return (
          <Panel>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
              <SectionTitle sub="Daily charges by provider">Burn chart</SectionTitle>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 11, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".05em", fontWeight: 500 }}>
                  Avg / day
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: "var(--ink)", fontVariantNumeric: "tabular-nums", marginTop: 2 }}>
                  {fmtUSD(dailyAvg)}
                </div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
                  over {series.length} days
                </div>
              </div>
            </div>
            <div style={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={series} margin={{ top: 5, right: 10, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "var(--ink-4)" }} />
                  <YAxis tickLine={false} axisLine={false} style={{ fontSize: 11, fill: "var(--ink-4)" }} tickFormatter={(v) => `$${v}`} />
                  <Tooltip
                    formatter={(v: number, n: string) => [fmtUSD(v), n]}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-3)" }} />
                  <ReferenceLine
                    y={dailyAvg}
                    stroke="var(--ink-3)"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Avg ${fmtUSD(dailyAvg)}`,
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "var(--ink-3)",
                      fontWeight: 500,
                    }}
                  />
                  <Line type="monotone" dataKey="anthropic" name="Anthropic" stroke={PROVIDER_HEX.anthropic} strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  <Line type="monotone" dataKey="openai"    name="OpenAI"    stroke={PROVIDER_HEX.openai}    strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        );
      })()}

      {/* Matched charges table */}
      {matched.length > 0 ? (
        <Panel padding={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <SectionTitle sub="Anthropic & OpenAI charges only">Matched charges</SectionTitle>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Provider</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {matched.map((r, i) => (
                <tr key={i}>
                  <Td mono style={{ color: "var(--ink-4)" }}>{r.date}</Td>
                  <Td style={{ maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.description}
                  </Td>
                  <Td>
                    <ProviderTag provider={r.provider as "anthropic" | "openai"} />
                  </Td>
                  <Td align="right" mono style={{ fontWeight: 600, color: "var(--ink)" }}>
                    {fmtUSD(r.amount)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      ) : (
        <Panel>
          <p style={{ fontSize: 13, color: "var(--ink-4)" }}>
            No charges found for {selectedMonth === "all" ? "this file" : monthLabel(selectedMonth)}.
          </p>
        </Panel>
      )}

    </div>
  );
}
