"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, LabelList, ReferenceLine,
} from "recharts";
import { Panel, SectionTitle, Metric, PageHeader, PROVIDER_HEX } from "@/components/ui";
import { fmtUSD } from "@/lib/format";
import { parseAmexCsv, type AmexRow } from "@/lib/amex-parser";
import { normaliseStore, type AmexStore } from "@/lib/amex-merge";
import { ChevronDown, ChevronUp } from "lucide-react";

const SHARED_KEY    = "amex_csv";
const LS_KEY_STORE  = "amex_store_v2";
const LS_KEY_BUDGET = "weekly_budget_v1";

/* ── Date helpers ─────────────────────────────────────────────────────────── */
function todayISO() { return new Date().toISOString().slice(0, 10); }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function monthRange(offset: number) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + offset;
  return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) };
}

/* ── ISO week helpers ─────────────────────────────────────────────────────── */
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, "0")}`;
}
function weekStart(weekKey: string): Date {
  const [year, w] = weekKey.split("-W").map(Number);
  const jan4    = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const monday  = new Date(jan4);
  monday.setDate(jan4.getDate() - (jan4Day - 1) + (w - 1) * 7);
  return monday;
}
function fmtWeekRange(weekKey: string): string {
  const mon = weekStart(weekKey);
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(mon)} – ${fmt(sun)}`;
}
function fmtWeekShort(weekKey: string): string {
  return weekStart(weekKey).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface WeekRow {
  key: string; label: string; short: string;
  anthropic: number; openai: number; total: number;
}

function buildWeeks(rows: AmexRow[], from: string, to: string): WeekRow[] {
  const byWeek = new Map<string, { anthropic: number; openai: number }>();
  for (const r of rows) {
    if (!r.date.startsWith("2026")) continue;
    if (r.provider !== "anthropic" && r.provider !== "openai") continue;
    if (r.date < from || r.date > to) continue;
    const key  = isoWeekKey(r.date);
    const slot = byWeek.get(key) ?? { anthropic: 0, openai: 0 };
    slot[r.provider] += r.amount;
    byWeek.set(key, slot);
  }
  return [...byWeek.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      key, label: fmtWeekRange(key), short: fmtWeekShort(key),
      anthropic: Number(v.anthropic.toFixed(2)),
      openai:    Number(v.openai.toFixed(2)),
      total:     Number((v.anthropic + v.openai).toFixed(2)),
    }));
}

type FilterPreset  = "all" | "this-month" | "last-month" | "custom";
type ProviderFilter = "both" | "anthropic" | "openai";

const PRESETS: { value: FilterPreset; label: string }[] = [
  { value: "all",        label: "All 2026"   },
  { value: "this-month", label: "This month" },
  { value: "last-month", label: "Last month" },
  { value: "custom",     label: "Custom"     },
];
const PROVIDERS: { value: ProviderFilter; label: string }[] = [
  { value: "both",      label: "Both"      },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai",    label: "OpenAI"    },
];

function btnStyle(active: boolean, danger = false): React.CSSProperties {
  return {
    padding: "6px 14px", borderRadius: "var(--r-sm)", fontSize: 13,
    fontWeight: 500, cursor: "pointer", border: "1px solid",
    borderColor: danger ? "var(--danger)" : active ? "var(--ink)" : "var(--line)",
    background:  active && !danger ? "var(--ink)" : "transparent",
    color:       danger ? "var(--danger)" : active ? "var(--bg)" : "var(--ink-3)",
    transition:  "all .12s",
  };
}

const STAT_DIVIDER: React.CSSProperties = {
  width: 1, alignSelf: "stretch", background: "var(--line)", margin: "0 4px", flexShrink: 0,
};

/* ── Component ────────────────────────────────────────────────────────────── */
export default function WeeklySpendPage() {
  const [store,     setStore]     = useState<AmexStore>({ rows: [], history: [] });
  const [loading,   setLoading]   = useState(true);
  const [tableOpen, setTableOpen] = useState(false);

  /* Date / provider filter */
  const [preset,     setPreset]     = useState<FilterPreset>("all");
  const [customFrom, setCustomFrom] = useState(() => monthRange(0).from);
  const [customTo,   setCustomTo]   = useState(() => todayISO());
  const [providerF,  setProviderF]  = useState<ProviderFilter>("both");

  /* Budget */
  const [weeklyBudget,  setWeeklyBudget]  = useState<number | null>(null);
  const [budgetDraft,   setBudgetDraft]   = useState("");
  const [editingBudget, setEditingBudget] = useState(false);

  /* Load data */
  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/shared?key=${SHARED_KEY}`);
        const json = await res.json();
        if (json.data) {
          const s = normaliseStore(json.data, parseAmexCsv);
          if (s.rows.length > 0) {
            setStore(s); localStorage.setItem(LS_KEY_STORE, JSON.stringify(s));
            setLoading(false); return;
          }
        }
      } catch { /* fallback */ }
      const saved = localStorage.getItem(LS_KEY_STORE);
      if (saved) {
        try {
          const s = JSON.parse(saved) as AmexStore;
          if (Array.isArray(s.rows) && s.rows.length > 0) setStore(s);
        } catch { /* ignore */ }
      }
      setLoading(false);
    }
    load();
  }, []);

  /* Load budget from localStorage */
  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY_BUDGET);
    if (saved) {
      const n = Number(saved);
      if (!isNaN(n) && n > 0) setWeeklyBudget(n);
    }
  }, []);

  function commitBudget() {
    const n = parseFloat(budgetDraft.replace(/[^0-9.]/g, ""));
    if (!isNaN(n) && n > 0) {
      setWeeklyBudget(n);
      localStorage.setItem(LS_KEY_BUDGET, String(n));
    }
    setEditingBudget(false);
  }
  function clearBudget() {
    setWeeklyBudget(null);
    localStorage.removeItem(LS_KEY_BUDGET);
    setEditingBudget(false);
  }

  /* Date range */
  const { from, to } = useMemo(() => {
    if (preset === "this-month") return monthRange(0);
    if (preset === "last-month") return monthRange(-1);
    if (preset === "custom")     return { from: customFrom, to: customTo };
    return { from: "2026-01-01", to: "2026-12-31" };
  }, [preset, customFrom, customTo]);

  const allWeeks = useMemo(() => buildWeeks(store.rows, from, to), [store, from, to]);

  /* Provider filter */
  const weeks = useMemo(() => allWeeks.map((w) => ({
    ...w,
    anthropic: providerF === "openai"    ? 0 : w.anthropic,
    openai:    providerF === "anthropic" ? 0 : w.openai,
    total:     providerF === "anthropic" ? w.anthropic
             : providerF === "openai"    ? w.openai
             : w.total,
  })).filter((w) => w.total > 0), [allWeeks, providerF]);

  const totalAnt = providerF === "openai"    ? 0 : allWeeks.reduce((s, w) => s + w.anthropic, 0);
  const totalOai = providerF === "anthropic" ? 0 : allWeeks.reduce((s, w) => s + w.openai, 0);
  const totalAll = totalAnt + totalOai;
  const avgWeek  = weeks.length > 0 ? totalAll / weeks.length : 0;
  const peakWeek = weeks.reduce<WeekRow | null>((best, w) => (!best || w.total > best.total) ? w : best, null);

  /* ── Budget metrics ── */
  const periodBudget = weeklyBudget != null && weeks.length > 0
    ? weeklyBudget * weeks.length : null;
  const variance = periodBudget != null ? totalAll - periodBudget : null;

  // Projected spend for the current (possibly incomplete) week
  const currentWeekKey  = isoWeekKey(todayISO());
  const currentWeekRow  = weeks.find((w) => w.key === currentWeekKey);
  const dayOfWeek       = new Date().getDay() || 7; // 1 Mon … 7 Sun
  const projectedThisWk = currentWeekRow
    ? Math.round((currentWeekRow.total / dayOfWeek) * 7 * 100) / 100
    : null;

  const rangeLabel = preset === "all" ? "All 2026"
    : preset === "this-month" ? "This month"
    : preset === "last-month" ? "Last month"
    : `${customFrom} → ${customTo}`;

  const inputStyle: React.CSSProperties = {
    border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
    background: "var(--panel-2)", color: "var(--ink)",
    padding: "5px 10px", fontSize: 13, outline: "none",
  };

  if (loading) return (
    <div>
      <PageHeader title="Weekly Spend" subtitle="Anthropic & OpenAI · 2026" />
      <Panel padding={24}><div style={{ fontSize: 13, color: "var(--ink-4)", textAlign: "center", padding: "24px 0" }}>Loading…</div></Panel>
    </div>
  );

  if (!loading && store.rows.length === 0) return (
    <div>
      <PageHeader title="Weekly Spend" subtitle="Anthropic & OpenAI · 2026" />
      <Panel padding={24}>
        <div style={{ fontSize: 13, color: "var(--ink-4)", textAlign: "center", padding: "32px 0" }}>
          No 2026 AI charges found. Upload your Amex CSV in{" "}
          <a href="/amex" style={{ color: "var(--accent)" }}>Amex Reconciliation</a>.
        </div>
      </Panel>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="Weekly Spend"
        subtitle={`Anthropic & OpenAI · 2026 · ${weeks.length} week${weeks.length === 1 ? "" : "s"} tracked`}
      />

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        <Metric label="Total" value={`$${Math.round(totalAll).toLocaleString()}`}
          sub={`${weeks.length} week${weeks.length === 1 ? "" : "s"} · ${rangeLabel.toLowerCase()}`} />
        <Metric label="Anthropic" value={`$${Math.round(totalAnt).toLocaleString()}`}
          sub={`${totalAll > 0 ? ((totalAnt / totalAll) * 100).toFixed(0) : 0}% of total`} />
        <Metric label="OpenAI" value={`$${Math.round(totalOai).toLocaleString()}`}
          sub={`${totalAll > 0 ? ((totalOai / totalAll) * 100).toFixed(0) : 0}% of total`} />
        <Metric label="Avg per week" value={`$${Math.round(avgWeek).toLocaleString()}`}
          sub={peakWeek ? `Peak: ${peakWeek.short} · $${Math.round(peakWeek.total).toLocaleString()}` : "—"} />
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {PRESETS.map((p) => (
          <button key={p.value} onClick={() => setPreset(p.value)} style={btnStyle(preset === p.value)}>
            {p.label}
          </button>
        ))}
        {preset === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={inputStyle} />
            <span style={{ fontSize: 12, color: "var(--ink-4)" }}>→</span>
            <input type="date" value={customTo}   onChange={(e) => setCustomTo(e.target.value)}   style={inputStyle} />
          </div>
        )}
        <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 4px", flexShrink: 0 }} />
        {PROVIDERS.map((p) => (
          <button key={p.value} onClick={() => setProviderF(p.value)} style={btnStyle(providerF === p.value)}>
            {p.label}
          </button>
        ))}
      </div>

      {/* ── Budget panel ── */}
      <Panel padding={16} style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>

          {/* Label + input */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "-.01em" }}>
              Weekly budget
            </span>

            {(editingBudget || weeklyBudget == null) ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 13, color: "var(--ink-4)" }}>$</span>
                <input
                  type="number"
                  min={0}
                  placeholder="e.g. 2500"
                  value={budgetDraft}
                  onChange={(e) => setBudgetDraft(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") commitBudget(); if (e.key === "Escape") setEditingBudget(false); }}
                  autoFocus={editingBudget}
                  style={{ ...inputStyle, width: 110 }}
                />
                <button onClick={commitBudget} style={{ ...btnStyle(true), padding: "5px 12px" }}>Set</button>
                {weeklyBudget != null && (
                  <button onClick={() => setEditingBudget(false)} style={{ ...btnStyle(false), padding: "5px 12px" }}>Cancel</button>
                )}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", fontVariantNumeric: "tabular-nums" }}>
                  {fmtUSD(weeklyBudget)}<span style={{ fontSize: 12, fontWeight: 500, color: "var(--ink-4)", marginLeft: 2 }}>/wk</span>
                </span>
                <button
                  onClick={() => { setBudgetDraft(String(weeklyBudget)); setEditingBudget(true); }}
                  style={{ ...btnStyle(false), padding: "3px 10px", fontSize: 12 }}
                >Edit</button>
                <button onClick={clearBudget} style={{ ...btnStyle(false, true), padding: "3px 10px", fontSize: 12 }}>
                  Clear
                </button>
              </div>
            )}
          </div>

          {/* Budget stats — only when budget is configured and we have weeks */}
          {weeklyBudget != null && periodBudget != null && weeks.length > 0 && (
            <>
              <div style={STAT_DIVIDER} />

              {/* Period budget */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-4)" }}>Period budget</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--ink)", marginTop: 1 }}>{fmtUSD(periodBudget)}</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>{weeks.length} wk × {fmtUSD(weeklyBudget)}</div>
              </div>

              <div style={STAT_DIVIDER} />

              {/* Actual */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-4)" }}>Actual</div>
                <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "var(--ink)", marginTop: 1 }}>{fmtUSD(totalAll)}</div>
                <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
                  {periodBudget > 0 ? ((totalAll / periodBudget) * 100).toFixed(0) : 0}% consumed
                </div>
              </div>

              <div style={STAT_DIVIDER} />

              {/* Variance */}
              {variance != null && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-4)" }}>Variance</div>
                  <div style={{
                    fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: 1,
                    color: variance > 0 ? "var(--danger)" : "var(--accent)",
                  }}>
                    {variance > 0 ? "▲" : "▼"} {fmtUSD(Math.abs(variance))}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
                    {variance > 0 ? "over budget" : "under budget"}
                  </div>
                </div>
              )}

              {/* Projected this week — only when the current week is in range */}
              {projectedThisWk != null && (
                <>
                  <div style={STAT_DIVIDER} />
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-4)" }}>
                      This week · projected
                    </div>
                    <div style={{
                      fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", marginTop: 1,
                      color: projectedThisWk > weeklyBudget ? "var(--danger)" : "var(--accent)",
                    }}>
                      {fmtUSD(projectedThisWk)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>
                      {projectedThisWk > weeklyBudget
                        ? `▲ ${fmtUSD(projectedThisWk - weeklyBudget)} over`
                        : `▼ ${fmtUSD(weeklyBudget - projectedThisWk)} under`}
                      {" · "}day {dayOfWeek}/7
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </Panel>

      {/* Bar chart */}
      <Panel padding={24} style={{ marginBottom: 24 }}>
        <SectionTitle sub={`Stacked by provider · each bar = one week · ${rangeLabel}`}>
          Weekly spend 2026
        </SectionTitle>
        {weeks.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--ink-4)" }}>
            No charges in this period.
          </div>
        ) : (
          <div style={{ height: 310 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeks} margin={{ top: 28, right: 8, left: -12, bottom: 0 }} barSize={weeks.length > 20 ? 10 : 18}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="short" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => fmtUSD(v, { compact: true })} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const w = payload[0]?.payload as WeekRow;
                    const isCurrentWk = w.key === currentWeekKey;
                    const projected   = isCurrentWk ? Math.round((w.total / dayOfWeek) * 7 * 100) / 100 : null;
                    const overBudget  = weeklyBudget != null ? w.total - weeklyBudget : null;
                    return (
                      <div style={{
                        background: "var(--panel)", border: "1px solid var(--line)",
                        borderRadius: "var(--r-sm)", padding: "10px 14px",
                        fontSize: 13, lineHeight: 1.7,
                        boxShadow: "0 4px 16px rgba(0,0,0,.12)",
                      }}>
                        <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                          {w.label}{isCurrentWk ? " · current week" : ""}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
                          <span style={{ color: PROVIDER_HEX.anthropic }}>Anthropic</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmtUSD(w.anthropic)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
                          <span style={{ color: PROVIDER_HEX.openai }}>OpenAI</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmtUSD(w.openai)}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, borderTop: "1px solid var(--line)", marginTop: 6, paddingTop: 6 }}>
                          <span style={{ color: "var(--ink)", fontWeight: 600 }}>Total</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700, color: "var(--ink)" }}>{fmtUSD(w.total)}</span>
                        </div>
                        {projected != null && (
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
                            <span style={{ color: "var(--ink-3)" }}>Projected</span>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500, color: "var(--ink-3)" }}>{fmtUSD(projected)}</span>
                          </div>
                        )}
                        {overBudget != null && (
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
                            <span style={{ color: overBudget > 0 ? "var(--danger)" : "var(--accent)" }}>vs budget</span>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: overBudget > 0 ? "var(--danger)" : "var(--accent)" }}>
                              {overBudget > 0 ? "▲" : "▼"} {fmtUSD(Math.abs(overBudget))}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend formatter={(v) => v === "anthropic" ? "Anthropic" : "OpenAI"} />
                {weeklyBudget != null && (
                  <ReferenceLine
                    y={weeklyBudget}
                    stroke="var(--danger)"
                    strokeDasharray="5 4"
                    strokeWidth={1.5}
                    label={{
                      value: `Budget ${fmtUSD(weeklyBudget)}`,
                      position: "insideTopRight",
                      fontSize: 11,
                      fill: "var(--danger)",
                      fontWeight: 500,
                    }}
                  />
                )}
                <Bar dataKey="anthropic" stackId="a" fill={PROVIDER_HEX.anthropic} radius={[0, 0, 0, 0]} />
                <Bar dataKey="openai"    stackId="a" fill={PROVIDER_HEX.openai}    radius={[3, 3, 0, 0]}>
                  <LabelList
                    dataKey="total"
                    position="top"
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    formatter={(v: any) => fmtUSD(v, { compact: true })}
                    style={{ fontSize: 10, fill: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Collapsible breakdown table */}
      <Panel>
        <button
          onClick={() => setTableOpen((o) => !o)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", background: "none", border: "none", cursor: "pointer",
            padding: 0, textAlign: "left",
          }}
        >
          <SectionTitle sub={`${weeks.length} week${weeks.length === 1 ? "" : "s"} · click to ${tableOpen ? "collapse" : "expand"}`}>
            Breakdown by week
          </SectionTitle>
          <span style={{ color: "var(--ink-4)", flexShrink: 0, marginBottom: 16 }}>
            {tableOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {tableOpen && weeks.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--line)" }}>
                {["Week", "Period", "Anthropic", "OpenAI", "Total", ...(weeklyBudget != null ? ["vs Budget"] : [])].map((h, i) => (
                  <th key={h} style={{
                    padding: "8px 12px", textAlign: i >= 2 ? "right" : "left",
                    fontSize: 10, fontWeight: 600, letterSpacing: ".05em",
                    textTransform: "uppercase", color: "var(--ink-4)",
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...weeks].reverse().map((w) => {
                const isCurrentWk  = w.key === currentWeekKey;
                const vsBudget     = weeklyBudget != null ? w.total - weeklyBudget : null;
                const isProjected  = isCurrentWk && dayOfWeek < 7;
                return (
                  <tr key={w.key} style={{ borderBottom: "1px solid var(--line)", background: isCurrentWk ? "var(--panel-2)" : "transparent" }}>
                    <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
                      {w.key}{isCurrentWk ? " ·" : ""}
                      {isCurrentWk && <span style={{ fontSize: 10, color: "var(--accent)", marginLeft: 4 }}>current</span>}
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "var(--ink)" }}>{w.label}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ color: w.anthropic > 0 ? PROVIDER_HEX.anthropic : "var(--ink-4)" }}>
                        {w.anthropic > 0 ? fmtUSD(w.anthropic) : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                      <span style={{ color: w.openai > 0 ? PROVIDER_HEX.openai : "var(--ink-4)" }}>
                        {w.openai > 0 ? fmtUSD(w.openai) : "—"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>
                      {fmtUSD(w.total)}
                      {isProjected && weeklyBudget == null && (
                        <div style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 400 }}>
                          ≈ {fmtUSD(Math.round((w.total / dayOfWeek) * 7 * 100) / 100)} proj.
                        </div>
                      )}
                    </td>
                    {weeklyBudget != null && vsBudget != null && (
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: vsBudget > 0 ? "var(--danger)" : "var(--accent)" }}>
                          {vsBudget > 0 ? "▲" : "▼"} {fmtUSD(Math.abs(vsBudget))}
                        </div>
                        {isProjected && (
                          <div style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 400 }}>
                            proj. {fmtUSD(Math.abs(Math.round((w.total / dayOfWeek) * 7 * 100) / 100 - weeklyBudget))}
                            {Math.round((w.total / dayOfWeek) * 7 * 100) / 100 > weeklyBudget ? " over" : " under"}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: "2px solid var(--line)" }}>
                <td colSpan={2} style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>Total</td>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums", color: PROVIDER_HEX.anthropic }}>{fmtUSD(totalAnt)}</td>
                <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums", color: PROVIDER_HEX.openai }}>{fmtUSD(totalOai)}</td>
                <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums", color: "var(--ink)" }}>{fmtUSD(totalAll)}</td>
                {weeklyBudget != null && variance != null && (
                  <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: variance > 0 ? "var(--danger)" : "var(--accent)" }}>
                      {variance > 0 ? "▲" : "▼"} {fmtUSD(Math.abs(variance))}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
                      {variance > 0 ? "over budget" : "under budget"}
                    </div>
                  </td>
                )}
              </tr>
            </tfoot>
          </table>
        )}
        {tableOpen && weeks.length === 0 && (
          <div style={{ padding: "24px 12px", fontSize: 13, color: "var(--ink-4)" }}>No charges in this period.</div>
        )}
      </Panel>
    </div>
  );
}
