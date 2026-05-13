"use client";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, Legend, LabelList, ReferenceLine, Cell,
  AreaChart, Area,
} from "recharts";
import { Panel, SectionTitle, Metric, PageHeader, PROVIDER_HEX } from "@/components/ui";
import { fmtUSD } from "@/lib/format";
import { parseAmexCsv, type AmexRow } from "@/lib/amex-parser";
import { normaliseStore, type AmexStore } from "@/lib/amex-merge";
import {
  ChevronDown, ChevronUp, Wallet,
  Download, Copy, Check, AlertTriangle,
} from "lucide-react";

const SHARED_KEY    = "amex_csv";
const LS_KEY_STORE  = "amex_store_v2";
const LS_KEY_BUDGET = "weekly_budget_v2";   // {anthropic: n|null, openai: n|null}

/* ── Date helpers ─────────────────────────────────────────────────────────── */
function todayISO() { return new Date().toISOString().slice(0, 10); }
function isoDate(d: Date) { return d.toISOString().slice(0, 10); }
function monthRange(offset: number) {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth() + offset;
  return { from: isoDate(new Date(y, m, 1)), to: isoDate(new Date(y, m + 1, 0)) };
}
function lastNWeeks(n: number) {
  const to   = new Date(); to.setDate(to.getDate() - 1);
  const from = new Date(); from.setDate(from.getDate() - n * 7);
  return { from: isoDate(from), to: isoDate(to) };
}
function ytdRange() {
  return { from: `${new Date().getFullYear()}-01-01`, to: todayISO() };
}
function lastQuarterRange() {
  const now = new Date();
  const q   = Math.floor(now.getMonth() / 3);
  const pq  = q === 0 ? 3 : q - 1;
  const py  = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
  return { from: isoDate(new Date(py, pq * 3, 1)), to: isoDate(new Date(py, pq * 3 + 3, 0)) };
}

/* ── ISO week helpers ─────────────────────────────────────────────────────── */
function isoWeekKey(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const day = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - day);
  const ys  = new Date(d.getFullYear(), 0, 1);
  const wk  = Math.ceil(((d.getTime() - ys.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, "0")}`;
}
function weekStart(wk: string): Date {
  const [year, w] = wk.split("-W").map(Number);
  const jan4    = new Date(year, 0, 4);
  const jan4Day = jan4.getDay() || 7;
  const mon     = new Date(jan4);
  mon.setDate(jan4.getDate() - (jan4Day - 1) + (w - 1) * 7);
  return mon;
}
function fmtWeekRange(wk: string) {
  const mon = weekStart(wk);
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  const f   = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${f(mon)} – ${f(sun)}`;
}
function fmtWeekShort(wk: string) {
  return weekStart(wk).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** All ISO week keys that overlap [from, to], ordered. */
function generateWeekKeys(from: string, to: string): string[] {
  const keys: string[] = [];
  let cur = weekStart(isoWeekKey(from));
  const end = new Date(to + "T00:00:00");
  while (cur <= end) {
    keys.push(isoWeekKey(isoDate(cur)));
    cur = new Date(cur); cur.setDate(cur.getDate() + 7);
  }
  return [...new Set(keys)];
}

interface WeekRow {
  key: string; label: string; short: string;
  anthropic: number; openai: number; total: number;
}

/** Build weeks for [from, to], including zero-spend weeks so metrics stay accurate. */
function buildWeeks(rows: AmexRow[], from: string, to: string): WeekRow[] {
  const keys  = generateWeekKeys(from, to);
  const byWk  = new Map<string, { anthropic: number; openai: number }>();
  for (const k of keys) byWk.set(k, { anthropic: 0, openai: 0 });

  for (const r of rows) {
    if (r.provider !== "anthropic" && r.provider !== "openai") continue;
    if (r.date < from || r.date > to) continue;
    const k = isoWeekKey(r.date);
    const s = byWk.get(k); if (!s) continue;
    s[r.provider] += r.amount;
  }
  return keys.map((key) => {
    const v = byWk.get(key)!;
    return {
      key, label: fmtWeekRange(key), short: fmtWeekShort(key),
      anthropic: Number(v.anthropic.toFixed(2)),
      openai:    Number(v.openai.toFixed(2)),
      total:     Number((v.anthropic + v.openai).toFixed(2)),
    };
  });
}

/** Previous period with equal duration, ending the day before `from`. */
function prevPeriodRange(from: string, to: string) {
  const f  = new Date(from + "T00:00:00");
  const t  = new Date(to   + "T00:00:00");
  const ms = t.getTime() - f.getTime() + 86400000;
  const pt = new Date(f.getTime() - 86400000);
  const pf = new Date(pt.getTime() - ms + 86400000);
  return { from: isoDate(pf), to: isoDate(pt) };
}

function exportCsv(weeks: WeekRow[], filename: string) {
  const header = "Week,Period,Anthropic,OpenAI,Total\n";
  const body   = weeks.map(w => `${w.key},"${w.label}",${w.anthropic},${w.openai},${w.total}`).join("\n");
  const url    = URL.createObjectURL(new Blob([header + body], { type: "text/csv;charset=utf-8;" }));
  Object.assign(document.createElement("a"), { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

/* ── Budget type ──────────────────────────────────────────────────────────── */
interface BudgetCfg { anthropic: number | null; openai: number | null; }
const NULL_BUDGET: BudgetCfg = { anthropic: null, openai: null };

/* ── Filter types ─────────────────────────────────────────────────────────── */
type FilterPreset  = "all" | "this-month" | "last-month" | "last-4-weeks" | "ytd" | "last-quarter" | "custom";
type ProviderFilter = "both" | "anthropic" | "openai";

const PRESETS: { value: FilterPreset; label: string }[] = [
  { value: "all",           label: "All 2026"    },
  { value: "this-month",    label: "This month"  },
  { value: "last-month",    label: "Last month"  },
  { value: "last-4-weeks",  label: "Last 4 wks"  },
  { value: "ytd",           label: "YTD"         },
  { value: "last-quarter",  label: "Last quarter"},
  { value: "custom",        label: "Custom"      },
];
const PROVIDERS: { value: ProviderFilter; label: string }[] = [
  { value: "both",      label: "Both"      },
  { value: "anthropic", label: "Anthropic" },
  { value: "openai",    label: "OpenAI"    },
];

/* ── Style helpers ────────────────────────────────────────────────────────── */
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
const INPUT_STYLE: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
  background: "var(--panel-2)", color: "var(--ink)",
  padding: "5px 10px", fontSize: 13, outline: "none",
};
const VDIV: React.CSSProperties = {
  width: 1, alignSelf: "stretch", background: "var(--line)", margin: "0 4px", flexShrink: 0,
};
function StatBox({ label, value, sub, tone }: {
  label: string; value: string; sub?: string; tone?: "danger" | "accent";
}) {
  const c = tone === "danger" ? "var(--danger)" : tone === "accent" ? "var(--accent)" : "var(--ink)";
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--ink-4)" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: c, marginTop: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--ink-4)", marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

/* ── Mini sparkline (passed as sparkline prop to Metric) ──────────────────── */
function MiniSparkline({ data, dataKey, color }: {
  data: WeekRow[]; dataKey: "total" | "anthropic" | "openai"; color: string;
}) {
  if (data.length < 2) return null;
  return (
    <div style={{ width: 80, height: 36, flexShrink: 0 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id={`sg-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0}    />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey}
            stroke={color} strokeWidth={1.5}
            fill={`url(#sg-${dataKey})`}
            dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Pace bar ─────────────────────────────────────────────────────────────── */
function PaceBar({ consumed, elapsed }: { consumed: number; elapsed: number }) {
  const cp     = Math.min(consumed * 100, 100);
  const ep     = Math.min(elapsed  * 100, 100);
  const ahead  = consumed > elapsed + 0.05;
  const color  = ahead ? "var(--danger)" : "var(--accent)";
  return (
    <Panel padding={14} style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: ".05em" }}>Budget pace</span>
        <span style={{ fontSize: 12, fontWeight: 600, color }}>{ahead ? "▲ Spending ahead of pace" : "▼ On track"}</span>
      </div>
      <div style={{ position: "relative", height: 8, background: "var(--line)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, width: `${cp}%`, background: color, borderRadius: 99, transition: "width .3s" }} />
        <div style={{ position: "absolute", top: 0, left: `${ep}%`, width: 2, height: "100%", background: "var(--ink)", transform: "translateX(-50%)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 5 }}>
        <span style={{ fontSize: 11, color }}>{cp.toFixed(0)}% budget consumed</span>
        <span style={{ fontSize: 11, color: "var(--ink-4)" }}>{ep.toFixed(0)}% of period elapsed</span>
      </div>
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
export default function WeeklySpendPage() {
  const [store,     setStore]     = useState<AmexStore>({ rows: [], history: [] });
  const [loading,   setLoading]   = useState(true);
  const [tableOpen, setTableOpen] = useState(false);
  const [copied,    setCopied]    = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);

  /* Filters */
  const [preset,     setPreset]     = useState<FilterPreset>("all");
  const [customFrom, setCustomFrom] = useState(() => monthRange(0).from);
  const [customTo,   setCustomTo]   = useState(() => todayISO());
  const [providerF,  setProviderF]  = useState<ProviderFilter>("both");

  /* Budget */
  const [budget,        setBudget]        = useState<BudgetCfg>(NULL_BUDGET);
  const [budgetDraft,   setBudgetDraft]   = useState<BudgetCfg>(NULL_BUDGET);
  const [editingBudget, setEditingBudget] = useState(false);

  /* ── Load data ── */
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
      const ls = localStorage.getItem(LS_KEY_STORE);
      if (ls) { try { const s = JSON.parse(ls) as AmexStore; if (s.rows?.length) setStore(s); } catch { /**/ } }
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    const ls = localStorage.getItem(LS_KEY_BUDGET);
    if (ls) { try { const b = JSON.parse(ls) as BudgetCfg; setBudget(b); setBudgetDraft(b); } catch { /**/ } }
  }, []);

  function commitBudget() {
    const b: BudgetCfg = {
      anthropic: (budgetDraft.anthropic ?? 0) > 0 ? budgetDraft.anthropic : null,
      openai:    (budgetDraft.openai    ?? 0) > 0 ? budgetDraft.openai    : null,
    };
    setBudget(b); localStorage.setItem(LS_KEY_BUDGET, JSON.stringify(b));
    setEditingBudget(false);
  }
  function clearBudget() {
    setBudget(NULL_BUDGET); setBudgetDraft(NULL_BUDGET);
    localStorage.removeItem(LS_KEY_BUDGET);
    setEditingBudget(false); setClearConfirm(false);
  }

  /* ── Date range ── */
  const { from, to } = useMemo(() => {
    if (preset === "this-month")   return monthRange(0);
    if (preset === "last-month")   return monthRange(-1);
    if (preset === "last-4-weeks") return lastNWeeks(4);
    if (preset === "ytd")          return ytdRange();
    if (preset === "last-quarter") return lastQuarterRange();
    if (preset === "custom")       return { from: customFrom, to: customTo };
    return { from: "2026-01-01", to: "2026-12-31" };
  }, [preset, customFrom, customTo]);

  /* ── Week data (includes zeros for accurate period budget) ── */
  const allWeeks  = useMemo(() => buildWeeks(store.rows, from, to), [store, from, to]);
  const prevRange = useMemo(() => prevPeriodRange(from, to), [from, to]);
  const prevWeeks = useMemo(() => buildWeeks(store.rows, prevRange.from, prevRange.to), [store, prevRange]);

  /* Apply provider filter to values (keep all week slots) */
  const weeks = useMemo(() => allWeeks.map((w) => ({
    ...w,
    anthropic: providerF === "openai"    ? 0 : w.anthropic,
    openai:    providerF === "anthropic" ? 0 : w.openai,
    total:     providerF === "anthropic" ? w.anthropic
             : providerF === "openai"    ? w.openai
             : w.total,
  })), [allWeeks, providerF]);

  /* ── Totals ── */
  const totalAnt = weeks.reduce((s, w) => s + w.anthropic, 0);
  const totalOai = weeks.reduce((s, w) => s + w.openai,    0);
  const totalAll = totalAnt + totalOai;
  const activeWks  = weeks.filter(w => w.total > 0);
  const avgWeek    = activeWks.length > 0 ? totalAll / activeWks.length : 0;
  const peakWeek   = activeWks.reduce<WeekRow | null>((b, w) => (!b || w.total > b.total) ? w : b, null);

  /* ── Budget derived ── */
  const hasBudget     = budget.anthropic != null || budget.openai != null;
  const budgetAntWk   = budget.anthropic ?? 0;
  const budgetOaiWk   = budget.openai    ?? 0;
  const totalBudgetWk = budgetAntWk + budgetOaiWk;

  const effectiveBudgetWk = providerF === "anthropic" ? budgetAntWk
                          : providerF === "openai"    ? budgetOaiWk
                          : totalBudgetWk;

  const periodBudget = hasBudget && effectiveBudgetWk > 0 ? effectiveBudgetWk * weeks.length : null;
  const variance     = periodBudget != null ? totalAll - periodBudget : null;

  /* ── Pace & projection ── */
  const currentWkKey   = isoWeekKey(todayISO());
  const weeksElapsed   = weeks.filter(w => w.key <= currentWkKey).length;
  const weeksRemaining = weeks.filter(w => w.key >  currentWkKey).length;
  const paceRatio      = weeks.length > 0 ? weeksElapsed  / weeks.length : 0;
  const budgetUsedRatio = periodBudget   ? totalAll / periodBudget       : 0;

  const avgPerElapsed    = weeksElapsed  > 0 ? totalAll / weeksElapsed : avgWeek;
  const projectedTotal   = totalAll + avgPerElapsed * weeksRemaining;
  const projectedVariance = periodBudget != null ? projectedTotal - periodBudget : null;

  const currentWkRow  = weeks.find(w => w.key === currentWkKey);
  const dayOfWeek     = new Date().getDay() || 7;
  const projectedThisWk = currentWkRow && currentWkRow.total > 0
    ? Math.round((currentWkRow.total / dayOfWeek) * 7 * 100) / 100
    : null;

  /* ── This-month projection (no carryover from previous months) ──────────
     Always tracks the current calendar month regardless of filter selection.
     Completed weeks → actual; current week → extrapolated; future weeks →
     average of completed weeks this month (or global avg if month just started).
  ── */
  const [tmFrom, tmTo] = useMemo(() => { const r = monthRange(0); return [r.from, r.to]; }, []);
  const thisMonthWkKeys = useMemo(() => generateWeekKeys(tmFrom, tmTo), [tmFrom, tmTo]);

  const thisMonthWeeks = useMemo(() => {
    const raw = buildWeeks(store.rows, tmFrom, tmTo);
    return raw.map(w => ({
      ...w,
      total: providerF === "anthropic" ? w.anthropic
           : providerF === "openai"    ? w.openai
           : w.total,
    }));
  }, [store, tmFrom, tmTo, providerF]);

  const monthBudget            = hasBudget && effectiveBudgetWk > 0 ? effectiveBudgetWk * thisMonthWkKeys.length : null;
  const completedMonthWkKeys   = thisMonthWkKeys.filter(k => k < currentWkKey);
  const futureMonthWkCount     = thisMonthWkKeys.filter(k => k > currentWkKey).length;
  const completedMonthSpend    = thisMonthWeeks.filter(w => w.key < currentWkKey).reduce((s, w) => s + w.total, 0);
  const currentMonthWkData     = thisMonthWeeks.find(w => w.key === currentWkKey);
  const isCurrentWkInMonth     = thisMonthWkKeys.includes(currentWkKey);
  const monthPacePerWk         = completedMonthWkKeys.length > 0
    ? completedMonthSpend / completedMonthWkKeys.length
    : avgPerElapsed;
  const projCurrentMonthWk     = isCurrentWkInMonth
    ? (currentMonthWkData && currentMonthWkData.total > 0
        ? Math.round((currentMonthWkData.total / dayOfWeek) * 7 * 100) / 100
        : monthPacePerWk)
    : 0;
  const monthProjected  = completedMonthSpend + projCurrentMonthWk + futureMonthWkCount * monthPacePerWk;
  const monthVariance   = monthBudget != null ? monthBudget - monthProjected : null;
  // positive = budget remaining for the month; negative = over budget

  /* ── Previous period comparison ── */
  const prevTotal = prevWeeks.reduce((s, w) => {
    const ant = providerF === "openai"    ? 0 : w.anthropic;
    const oai = providerF === "anthropic" ? 0 : w.openai;
    return s + ant + oai;
  }, 0);
  const showPrevComp   = prevTotal > 0;
  const prevDelta      = totalAll - prevTotal;
  const prevDeltaPct   = prevTotal > 0 ? (prevDelta / prevTotal) * 100 : null;

  /* ── Chart data with over-budget flag ── */
  const chartWeeks = useMemo(() => weeks.map((w) => ({
    ...w,
    overBudget: hasBudget && effectiveBudgetWk > 0 && w.total > effectiveBudgetWk,
  })), [weeks, hasBudget, effectiveBudgetWk]);

  /* Sparkline: last 12 weeks (all, including zeros) */
  const sparkData = useMemo(() => weeks.slice(-12), [weeks]);

  const showAlert = hasBudget && monthVariance != null && monthVariance < 0 && isCurrentWkInMonth;

  const rangeLabel = preset === "all" ? "All 2026"
    : preset === "this-month"   ? "This month"
    : preset === "last-month"   ? "Last month"
    : preset === "last-4-weeks" ? "Last 4 weeks"
    : preset === "ytd"          ? "YTD"
    : preset === "last-quarter" ? "Last quarter"
    : `${customFrom} → ${customTo}`;

  function copyCSV() {
    const rows = weeks.filter(w => w.total > 0)
      .map(w => `${w.key},"${w.label}",${w.anthropic},${w.openai},${w.total}`).join("\n");
    navigator.clipboard.writeText(`Week,Period,Anthropic,OpenAI,Total\n${rows}`)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  /* ── Loading / empty states ── */
  if (loading) return (
    <div>
      <PageHeader title="Weekly Spend" subtitle="Anthropic & OpenAI · 2026" />
      <Panel padding={24}><div style={{ fontSize: 13, color: "var(--ink-4)", textAlign: "center", padding: "24px 0" }}>Loading…</div></Panel>
    </div>
  );
  if (store.rows.length === 0) return (
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

  /* ══════════════════════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div>
      <PageHeader
        title="Weekly Spend"
        subtitle={`Anthropic & OpenAI · 2026 · ${activeWks.length} week${activeWks.length === 1 ? "" : "s"} with activity`}
      />

      {/* ── Summary cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 20 }}>
        <Metric
          label="Total" value={fmtUSD(totalAll)}
          sub={`${weeks.length} wks tracked · ${rangeLabel.toLowerCase()}`}
          sparkline={<MiniSparkline data={sparkData} dataKey="total" color="var(--ink-3)" />}
        />
        <Metric
          label="Anthropic" value={fmtUSD(totalAnt)}
          sub={`${totalAll > 0 ? ((totalAnt / totalAll) * 100).toFixed(0) : 0}% of total`}
          sparkline={<MiniSparkline data={sparkData} dataKey="anthropic" color={PROVIDER_HEX.anthropic} />}
        />
        <Metric
          label="OpenAI" value={fmtUSD(totalOai)}
          sub={`${totalAll > 0 ? ((totalOai / totalAll) * 100).toFixed(0) : 0}% of total`}
          sparkline={<MiniSparkline data={sparkData} dataKey="openai" color={PROVIDER_HEX.openai} />}
        />
        {hasBudget && monthBudget != null ? (
          <Metric
            label="This month · projected"
            value={fmtUSD(monthProjected)}
            sub={monthVariance != null
              ? monthVariance >= 0
                ? `▼ ${fmtUSD(monthVariance)} remaining`
                : `▲ ${fmtUSD(Math.abs(monthVariance))} over budget`
              : "—"}
            delta={`budget ${fmtUSD(monthBudget)}`}
            deltaTone={monthVariance != null && monthVariance < 0 ? "down" : "neutral"}
          />
        ) : (
          <Metric
            label="Avg / week" value={fmtUSD(avgWeek)}
            sub={peakWeek ? `Peak: ${peakWeek.short} · ${fmtUSD(peakWeek.total)}` : "—"}
            sparkline={<MiniSparkline data={sparkData} dataKey="total" color="var(--ink-4)" />}
          />
        )}
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        {PRESETS.map((p) => (
          <button key={p.value} onClick={() => setPreset(p.value)} style={btnStyle(preset === p.value)}>{p.label}</button>
        ))}
        {preset === "custom" && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={INPUT_STYLE} />
            <span style={{ fontSize: 12, color: "var(--ink-4)" }}>→</span>
            <input type="date" value={customTo}   onChange={(e) => setCustomTo(e.target.value)}   style={INPUT_STYLE} />
          </div>
        )}
        <div style={{ width: 1, height: 22, background: "var(--line)", margin: "0 4px" }} />
        {PROVIDERS.map((p) => (
          <button key={p.value} onClick={() => setProviderF(p.value)} style={btnStyle(providerF === p.value)}>{p.label}</button>
        ))}
      </div>

      {/* ── Budget panel ── */}
      <Panel padding={16} style={{ marginBottom: 16 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Wallet size={14} style={{ color: "var(--ink-4)", flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-3)" }}>Weekly budget</span>

          {!editingBudget && !hasBudget && (
            <button onClick={() => { setBudgetDraft(NULL_BUDGET); setEditingBudget(true); }}
              style={{ ...btnStyle(false), padding: "4px 12px" }}>
              Set budget →
            </button>
          )}

          {!editingBudget && hasBudget && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {budget.anthropic != null && (
                <span style={{ fontSize: 13, color: PROVIDER_HEX.anthropic, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  Ant {fmtUSD(budget.anthropic)}/wk
                </span>
              )}
              {budget.anthropic != null && budget.openai != null && <span style={{ color: "var(--ink-4)" }}>·</span>}
              {budget.openai != null && (
                <span style={{ fontSize: 13, color: PROVIDER_HEX.openai, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                  OAI {fmtUSD(budget.openai)}/wk
                </span>
              )}
              {budget.anthropic != null && budget.openai != null && (
                <span style={{ fontSize: 12, color: "var(--ink-4)" }}>= {fmtUSD(totalBudgetWk)}/wk total</span>
              )}
              <button onClick={() => { setBudgetDraft({ ...budget }); setEditingBudget(true); }}
                style={{ ...btnStyle(false), padding: "3px 10px", fontSize: 12 }}>Edit</button>
              {clearConfirm ? (
                <>
                  <span style={{ fontSize: 12, color: "var(--danger)" }}>Remove budget?</span>
                  <button onClick={clearBudget} style={{ ...btnStyle(false, true), padding: "3px 10px", fontSize: 12 }}>Yes</button>
                  <button onClick={() => setClearConfirm(false)} style={{ ...btnStyle(false), padding: "3px 10px", fontSize: 12 }}>No</button>
                </>
              ) : (
                <button onClick={() => setClearConfirm(true)} style={{ ...btnStyle(false, true), padding: "3px 10px", fontSize: 12 }}>Clear</button>
              )}
            </div>
          )}
        </div>

        {/* Edit form */}
        {editingBudget && (
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
            {(["anthropic", "openai"] as const).map((p) => (
              <div key={p} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: PROVIDER_HEX[p], width: 72 }}>
                  {p === "anthropic" ? "Anthropic" : "OpenAI"}
                </span>
                <span style={{ fontSize: 13, color: "var(--ink-4)" }}>$</span>
                <input
                  type="number" min={0} placeholder="e.g. 2000"
                  value={budgetDraft[p] ?? ""}
                  onChange={(e) => setBudgetDraft(d => ({ ...d, [p]: e.target.value ? Number(e.target.value) : null }))}
                  onKeyDown={(e) => { if (e.key === "Enter") commitBudget(); if (e.key === "Escape") setEditingBudget(false); }}
                  style={{ ...INPUT_STYLE, width: 100 }}
                />
                <span style={{ fontSize: 12, color: "var(--ink-4)" }}>/week</span>
              </div>
            ))}
            {((budgetDraft.anthropic ?? 0) + (budgetDraft.openai ?? 0)) > 0 && (
              <span style={{ fontSize: 12, color: "var(--ink-4)" }}>
                = {fmtUSD((budgetDraft.anthropic ?? 0) + (budgetDraft.openai ?? 0))}/wk
              </span>
            )}
            <button onClick={commitBudget}            style={{ ...btnStyle(true),  padding: "5px 14px" }}>Save</button>
            <button onClick={() => setEditingBudget(false)} style={{ ...btnStyle(false), padding: "5px 14px" }}>Cancel</button>
          </div>
        )}

        {/* Budget stats */}
        {hasBudget && periodBudget != null && !editingBudget && (
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginTop: 14, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
            <StatBox label="Period budget" value={fmtUSD(periodBudget)}
              sub={`${weeks.length} wk × ${fmtUSD(effectiveBudgetWk)}`} />
            <div style={VDIV} />
            <StatBox label="Actual" value={fmtUSD(totalAll)}
              sub={`${periodBudget > 0 ? ((totalAll / periodBudget) * 100).toFixed(0) : 0}% consumed`} />
            {variance != null && (
              <>
                <div style={VDIV} />
                <StatBox label="Variance"
                  value={`${variance > 0 ? "▲" : "▼"} ${fmtUSD(Math.abs(variance))}`}
                  sub={variance > 0 ? "over budget" : "under budget"}
                  tone={variance > 0 ? "danger" : "accent"} />
              </>
            )}
            {projectedThisWk != null && effectiveBudgetWk > 0 && (
              <>
                <div style={VDIV} />
                <StatBox
                  label="This week · projected"
                  value={fmtUSD(projectedThisWk)}
                  sub={projectedThisWk > effectiveBudgetWk
                    ? `▲ ${fmtUSD(projectedThisWk - effectiveBudgetWk)} over · day ${dayOfWeek}/7`
                    : `▼ ${fmtUSD(effectiveBudgetWk - projectedThisWk)} under · day ${dayOfWeek}/7`}
                  tone={projectedThisWk > effectiveBudgetWk ? "danger" : "accent"}
                />
              </>
            )}
            {monthBudget != null && monthVariance != null && (
              <>
                <div style={VDIV} />
                <StatBox
                  label="This month · projection"
                  value={fmtUSD(monthProjected)}
                  sub={monthVariance >= 0
                    ? `▼ ${fmtUSD(monthVariance)} remaining of ${fmtUSD(monthBudget)}`
                    : `▲ ${fmtUSD(Math.abs(monthVariance))} over · budget ${fmtUSD(monthBudget)}`}
                  tone={monthVariance < 0 ? "danger" : "accent"}
                />
              </>
            )}
          </div>
        )}
      </Panel>

      {/* ── Pace bar ── */}
      {hasBudget && paceRatio > 0 && totalAll > 0 && (
        <PaceBar consumed={budgetUsedRatio} elapsed={paceRatio} />
      )}

      {/* ── Alert banner ── */}
      {showAlert && monthVariance != null && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10, padding: "12px 16px",
          borderRadius: "var(--r-sm)", border: "1px solid var(--danger)",
          background: "rgba(220, 38, 38, 0.07)", marginBottom: 16, fontSize: 13,
        }}>
          <AlertTriangle size={15} style={{ color: "var(--danger)", flexShrink: 0 }} />
          <span style={{ color: "var(--ink)", fontWeight: 500 }}>
            At current pace you&apos;re projected to exceed this month&apos;s budget by{" "}
            <strong style={{ color: "var(--danger)" }}>{fmtUSD(Math.abs(monthVariance))}</strong>
            {" "}({fmtUSD(monthProjected)} projected vs {fmtUSD(monthBudget ?? 0)} monthly budget).
          </span>
        </div>
      )}

      {/* ── Bar chart ── */}
      <Panel padding={24} style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
          <SectionTitle sub={`Stacked by provider · each bar = one week · ${rangeLabel}`}>
            Weekly spend 2026
          </SectionTitle>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button onClick={copyCSV}
              style={{ ...btnStyle(false), padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
              {copied ? "Copied!" : "Copy CSV"}
            </button>
            <button onClick={() => exportCsv(weeks.filter(w => w.total > 0), `weekly-spend-${from}-to-${to}.csv`)}
              style={{ ...btnStyle(false), padding: "4px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
              <Download size={12} /> Download
            </button>
          </div>
        </div>

        {totalAll === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center", fontSize: 13, color: "var(--ink-4)" }}>
            No charges in this period.
          </div>
        ) : (
          <div style={{ height: 310 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartWeeks} margin={{ top: 28, right: 8, left: -12, bottom: 0 }} barSize={chartWeeks.length > 20 ? 10 : 18}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="short" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => fmtUSD(v, { compact: true })} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const w = payload[0]?.payload as WeekRow & { overBudget: boolean };
                    const isCurrentWk = w.key === currentWkKey;
                    const proj        = isCurrentWk && w.total > 0 ? Math.round((w.total / dayOfWeek) * 7 * 100) / 100 : null;
                    const vsBudget    = effectiveBudgetWk > 0 ? w.total - effectiveBudgetWk : null;
                    return (
                      <div style={{
                        background: "var(--panel)", border: "1px solid var(--line)",
                        borderRadius: "var(--r-sm)", padding: "10px 14px",
                        fontSize: 13, lineHeight: 1.7, boxShadow: "0 4px 16px rgba(0,0,0,.12)",
                      }}>
                        <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 6 }}>
                          {w.label}
                          {isCurrentWk && <span style={{ fontSize: 11, color: "var(--accent)", marginLeft: 6 }}>current week</span>}
                          {w.overBudget && <span style={{ fontSize: 11, color: "var(--danger)", marginLeft: 6 }}>▲ over budget</span>}
                        </div>
                        {providerF !== "openai" && (
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
                            <span style={{ color: PROVIDER_HEX.anthropic }}>Anthropic</span>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmtUSD(w.anthropic)}</span>
                          </div>
                        )}
                        {providerF !== "anthropic" && (
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
                            <span style={{ color: PROVIDER_HEX.openai }}>OpenAI</span>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>{fmtUSD(w.openai)}</span>
                          </div>
                        )}
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, borderTop: "1px solid var(--line)", marginTop: 6, paddingTop: 6 }}>
                          <span style={{ fontWeight: 600 }}>Total</span>
                          <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 700 }}>{fmtUSD(w.total)}</span>
                        </div>
                        {proj != null && (
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
                            <span style={{ color: "var(--ink-3)" }}>Projected (7d)</span>
                            <span style={{ fontVariantNumeric: "tabular-nums", color: "var(--ink-3)" }}>{fmtUSD(proj)}</span>
                          </div>
                        )}
                        {vsBudget != null && (
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 24 }}>
                            <span style={{ color: vsBudget > 0 ? "var(--danger)" : "var(--accent)" }}>vs budget</span>
                            <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600, color: vsBudget > 0 ? "var(--danger)" : "var(--accent)" }}>
                              {vsBudget > 0 ? "▲" : "▼"} {fmtUSD(Math.abs(vsBudget))}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                <Legend formatter={(v) => v === "anthropic" ? "Anthropic" : "OpenAI"} />

                {/* Budget reference line */}
                {hasBudget && effectiveBudgetWk > 0 && (
                  <ReferenceLine y={effectiveBudgetWk} stroke="var(--danger)" strokeDasharray="5 4" strokeWidth={1.5}
                    label={{ value: `Budget ${fmtUSD(effectiveBudgetWk)}/wk`, position: "insideBottomRight", fontSize: 11, fill: "var(--danger)", fontWeight: 500 }} />
                )}

                {/* Anthropic bar — shown when not "openai only" */}
                {providerF !== "openai" && (
                  <Bar dataKey="anthropic" stackId="a" fill={PROVIDER_HEX.anthropic}
                    radius={providerF === "anthropic" ? [3, 3, 0, 0] : [0, 0, 0, 0]}>
                    {chartWeeks.map((e, i) => (
                      <Cell key={i} fill={e.overBudget ? "#b83228" : PROVIDER_HEX.anthropic} />
                    ))}
                    {providerF === "anthropic" && (
                      <LabelList dataKey="total" position="top"
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={(v: any) => v > 0 ? fmtUSD(v, { compact: true }) : ""}
                        style={{ fontSize: 10, fill: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }} />
                    )}
                  </Bar>
                )}

                {/* OpenAI bar — shown when not "anthropic only" */}
                {providerF !== "anthropic" && (
                  <Bar dataKey="openai" stackId="a" fill={PROVIDER_HEX.openai} radius={[3, 3, 0, 0]}>
                    {chartWeeks.map((e, i) => (
                      <Cell key={i} fill={e.overBudget ? "#e05d44" : PROVIDER_HEX.openai} />
                    ))}
                    <LabelList dataKey="total" position="top"
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={(v: any) => v > 0 ? fmtUSD(v, { compact: true }) : ""}
                      style={{ fontSize: 10, fill: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }} />
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* ── Previous period comparison ── */}
      {showPrevComp && (
        <Panel padding={14} style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", fontSize: 13 }}>
            <span style={{ fontWeight: 600, color: "var(--ink-3)" }}>vs prev. period</span>
            <span style={{ fontWeight: 700, color: prevDelta > 0 ? "var(--danger)" : "var(--accent)" }}>
              {prevDelta > 0 ? "▲" : "▼"} {fmtUSD(Math.abs(prevDelta))}
              {prevDeltaPct != null && ` (${Math.abs(prevDeltaPct).toFixed(0)}%)`}
            </span>
            <span style={{ color: "var(--ink-4)", fontSize: 12 }}>
              prev {fmtUSD(prevTotal)} · current {fmtUSD(totalAll)}
            </span>
            <span style={{ color: "var(--ink-4)", fontSize: 11 }}>
              ({prevRange.from} – {prevRange.to})
            </span>
          </div>
        </Panel>
      )}

      {/* ── Collapsible breakdown table ── */}
      <Panel>
        <button onClick={() => setTableOpen((o) => !o)} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0,
        }}>
          <SectionTitle sub={`${activeWks.length} week${activeWks.length === 1 ? "" : "s"} with activity · click to ${tableOpen ? "collapse" : "expand"}`}>
            Breakdown by week
          </SectionTitle>
          <span style={{ color: "var(--ink-4)", flexShrink: 0, marginBottom: 16 }}>
            {tableOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </span>
        </button>

        {tableOpen && (
          <>
            {activeWks.length === 0 ? (
              <div style={{ padding: "24px 12px", fontSize: 13, color: "var(--ink-4)" }}>No charges in this period.</div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--line)" }}>
                    {["Week", "Period", "Anthropic", "OpenAI", "Total", ...(hasBudget ? ["vs Budget"] : [])].map((h, i) => (
                      <th key={h} style={{
                        padding: "8px 12px", textAlign: i >= 2 ? "right" : "left",
                        fontSize: 10, fontWeight: 600, letterSpacing: ".05em",
                        textTransform: "uppercase", color: "var(--ink-4)",
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...weeks].filter(w => w.total > 0).reverse().map((w) => {
                    const isCur      = w.key === currentWkKey;
                    const vsBudget   = hasBudget && effectiveBudgetWk > 0 ? w.total - effectiveBudgetWk : null;
                    const isPartial  = isCur && dayOfWeek < 7;
                    const proj7d     = isPartial ? Math.round((w.total / dayOfWeek) * 7 * 100) / 100 : null;
                    return (
                      <tr key={w.key} style={{
                        borderBottom: "1px solid var(--line)",
                        background: isCur ? "color-mix(in srgb, var(--accent) 5%, transparent)" : "transparent",
                      }}>
                        <td style={{ padding: "10px 12px", fontSize: 12, fontWeight: 600, color: "var(--ink-3)" }}>
                          {w.key}
                          {isCur && <span style={{ marginLeft: 5, fontSize: 10, color: "var(--accent)", fontWeight: 500 }}>current</span>}
                        </td>
                        <td style={{ padding: "10px 12px", fontSize: 13 }}>{w.label}</td>
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
                        <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{fmtUSD(w.total)}</div>
                          {proj7d != null && (
                            <div style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 400 }}>≈ {fmtUSD(proj7d)} proj.</div>
                          )}
                        </td>
                        {hasBudget && vsBudget != null && (
                          <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: vsBudget > 0 ? "var(--danger)" : "var(--accent)" }}>
                              {vsBudget > 0 ? "▲" : "▼"} {fmtUSD(Math.abs(vsBudget))}
                            </div>
                            {proj7d != null && effectiveBudgetWk > 0 && (
                              <div style={{ fontSize: 10, color: "var(--ink-4)", fontWeight: 400 }}>
                                proj. {proj7d > effectiveBudgetWk ? "▲" : "▼"} {fmtUSD(Math.abs(proj7d - effectiveBudgetWk))}
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
                    <td colSpan={2} style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>Total</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums", color: PROVIDER_HEX.anthropic }}>{fmtUSD(totalAnt)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600, textAlign: "right", fontVariantNumeric: "tabular-nums", color: PROVIDER_HEX.openai }}>{fmtUSD(totalOai)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 14, fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmtUSD(totalAll)}</td>
                    {hasBudget && variance != null && (
                      <td style={{ padding: "10px 12px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: variance > 0 ? "var(--danger)" : "var(--accent)" }}>
                          {variance > 0 ? "▲" : "▼"} {fmtUSD(Math.abs(variance))}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--ink-4)" }}>{variance > 0 ? "over" : "under"} budget</div>
                      </td>
                    )}
                  </tr>
                </tfoot>
              </table>
            )}
          </>
        )}
      </Panel>
    </div>
  );
}
