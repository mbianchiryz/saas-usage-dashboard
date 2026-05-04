"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Cloud } from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from "recharts";
import { Panel, SectionTitle, Metric, Sparkline } from "@/components/ui";
import { fmtUSD } from "@/lib/format";
import { parseAmexCsv, type AmexRow } from "@/lib/amex-parser";
import { normaliseStore, type AmexStore } from "@/lib/amex-merge";
import { parseRange, rangeDays } from "@/lib/dateRange";
import { classifySaas, CATEGORY_LABEL, type SaasCategory, type UserVendorRule } from "@/lib/saas-classifier";
import type { SaasVendor } from "@/lib/saas-vendors";

const SHARED_KEY   = "amex_csv";
const LS_KEY_STORE = "amex_store_v2";

/* Stable colour palette for category pie / labels. Order matters — first 9 are
 * the named categories, the rest fall back through the palette. */
const CAT_COLORS: Record<SaasCategory, string> = {
  it:         "#0EA5E9",
  dev:        "#8B5CF6",
  sales:      "#F59E0B",
  recruiting: "#EC4899",
  accounting: "#10B981",
  video:      "#EF4444",
  hiptrain:   "#F97316",
  offsiteio:  "#14B8A6",
  ntrvsta:    "#6366F1",
  all:        "#64748B",
  other:      "#94A3B8",
};

interface VendorRow { name: string; category: SaasCategory; total: number }
interface CatRow    { category: SaasCategory; total: number }

interface Computed {
  series:        { date: string; total: number }[];
  total:         number;
  burn:          number;
  days:          number;
  topVendors:    VendorRow[];     // up to 6
  byCategory:    CatRow[];        // sorted desc
  vendorCount:   number;
  topCatTotal:   number;
  topCategory:   SaasCategory | null;
  totalSpark:    number[];
}

const EMPTY: Computed = {
  series: [], total: 0, burn: 0, days: 0,
  topVendors: [], byCategory: [], vendorCount: 0,
  topCatTotal: 0, topCategory: null, totalSpark: [],
};

function pad(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function compute(rows: AmexRow[], userVendors: SaasVendor[], from: string, to: string): Computed {
  if (rows.length === 0) return EMPTY;

  const inRange = rows.filter((r) => r.date >= from && r.date <= to);
  if (inRange.length === 0) return { ...EMPTY, days: rangeDays({ from, to }) };

  /* Strip the catalog down to the shape the classifier wants */
  const userRules: UserVendorRule[] = userVendors.map((v) => ({
    name: v.name, category: v.category, patterns: v.patterns,
  }));

  /* Per-vendor and per-category totals */
  const byVendor   = new Map<string, VendorRow>();
  const byCategory = new Map<SaasCategory, number>();
  let total = 0;

  for (const r of inRange) {
    const { name, category } = classifySaas(r.description, userRules);
    total += r.amount;
    const v = byVendor.get(name) ?? { name, category, total: 0 };
    v.total += r.amount;
    byVendor.set(name, v);
    byCategory.set(category, (byCategory.get(category) ?? 0) + r.amount);
  }

  const topVendors = [...byVendor.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  const catRows: CatRow[] = [...byCategory.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  /* Daily series across the full range so empty days render as zero */
  const byDay = new Map<string, number>();
  for (let d = new Date(from + "T00:00:00"); isoDate(d) <= to; d.setDate(d.getDate() + 1)) {
    byDay.set(isoDate(d), 0);
  }
  for (const r of inRange) {
    if (byDay.has(r.date)) byDay.set(r.date, byDay.get(r.date)! + r.amount);
  }
  const series = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, t]) => ({ date, total: Number(t.toFixed(2)) }));

  const days = rangeDays({ from, to });
  const burn = total / days;
  const sparkN = Math.min(14, series.length);
  const totalSpark = series.slice(-sparkN).map((s) => s.total);

  return {
    series, total, burn, days,
    topVendors, byCategory: catRows,
    vendorCount: byVendor.size,
    topCategory: catRows[0]?.category ?? null,
    topCatTotal: catRows[0]?.total ?? 0,
    totalSpark,
  };
}

/* ── Inline daily chart (single area, total SaaS spend per day) ───────────── */
function DailySpendChart({ series, burn, rangeLabel }: {
  series: { date: string; total: number }[]; burn: number; rangeLabel: string;
}) {
  return (
    <Panel padding={24} style={{ marginBottom: 24 }}>
      <SectionTitle
        sub={`Total SaaS spend per day · ${rangeLabel.toLowerCase()}`}
        right={
          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
            Burn rate{" "}
            <span className="tnum" style={{ color: "var(--ink)", fontWeight: 600, marginLeft: 4 }}>
              {fmtUSD(burn)}/day
            </span>
          </span>
        }
      >
        Daily spend
      </SectionTitle>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <defs>
              <linearGradient id="saasG" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="var(--accent)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={(v) => v.slice(5)} />
            <YAxis tickLine={false} axisLine={false} tickFormatter={(v) => fmtUSD(v, { compact: true })} />
            <Tooltip formatter={(v: number) => [fmtUSD(v), "SaaS spend"]} />
            <Area type="monotone" dataKey="total" stroke="var(--accent)" fill="url(#saasG)" strokeWidth={1.75} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

/* ── Inline category mix donut (replaces ProviderMixChart) ────────────────── */
function CategoryMixChart({ rows, total }: { rows: CatRow[]; total: number }) {
  const data = rows.map((r) => ({
    name:  CATEGORY_LABEL[r.category],
    value: Number(r.total.toFixed(2)),
    fill:  CAT_COLORS[r.category],
  }));
  /* Show top 4 inline and roll the rest into "Other" for the legend list */
  const legendTop  = rows.slice(0, 4);
  const legendRest = rows.slice(4);
  const restTotal  = legendRest.reduce((s, r) => s + r.total, 0);

  return (
    <Panel>
      <SectionTitle sub="Share of SaaS spend by team / category">Category mix</SectionTitle>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <div style={{ width: 130, height: 130, position: "relative", flexShrink: 0 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" cx="50%" cy="50%" innerRadius={42} outerRadius={62} stroke="var(--panel)" strokeWidth={2}>
                {data.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip formatter={(v: number, n: string) => [fmtUSD(v), n]} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", pointerEvents: "none" }}>
            <div style={{ fontSize: 10, color: "var(--ink-4)", textTransform: "uppercase", letterSpacing: ".06em" }}>Total</div>
            <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              ${Math.round(total).toLocaleString()}
            </div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          {legendTop.map((r) => (
            <div key={r.category} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: CAT_COLORS[r.category], flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: "var(--ink-2)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {CATEGORY_LABEL[r.category]}
                </span>
              </div>
              <div className="tnum" style={{ fontSize: 12, color: "var(--ink)", fontWeight: 500 }}>
                {total > 0 ? `${((r.total / total) * 100).toFixed(0)}%` : "—"}
              </div>
            </div>
          ))}
          {legendRest.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: "var(--ink-4)" }} />
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                  +{legendRest.length} more
                </span>
              </div>
              <div className="tnum" style={{ fontSize: 12, color: "var(--ink-3)" }}>
                {total > 0 ? `${((restTotal / total) * 100).toFixed(0)}%` : "—"}
              </div>
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}

/* ─────────────────────────────────────────────────────────────────────────── */

export function AmexOverviewSection() {
  const [store,        setStore]        = useState<AmexStore>({ rows: [], history: [] });
  const [userVendors,  setUserVendors]  = useState<SaasVendor[]>([]);
  const [loading,      setLoading]      = useState(true);
  const sp     = useSearchParams();
  const range  = useMemo(() => parseRange(sp ?? new URLSearchParams()), [sp]);

  useEffect(() => {
    async function load() {
      try {
        const [sharedRes, vendorRes] = await Promise.all([
          fetch(`/api/shared?key=${SHARED_KEY}`).then((r) => r.json()).catch(() => ({ data: null })),
          fetch(`/api/saas-vendors`).then((r) => r.json()).catch(() => ({ vendors: [] })),
        ]);
        setUserVendors(Array.isArray(vendorRes.vendors) ? vendorRes.vendors : []);

        if (sharedRes?.data) {
          const s = normaliseStore(sharedRes.data, parseAmexCsv);
          if (s.rows.length > 0) {
            setStore(s);
            localStorage.setItem(LS_KEY_STORE, JSON.stringify(s));
            setLoading(false);
            return;
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

  const m = useMemo(
    () => compute(store.rows, userVendors, range.from, range.to),
    [store, userVendors, range.from, range.to],
  );

  if (loading) {
    return (
      <Panel padding={24} style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: "var(--ink-4)", textAlign: "center", padding: "20px 0" }}>
          Loading SaaS data…
        </div>
      </Panel>
    );
  }

  if (store.rows.length === 0) {
    return (
      <Panel padding={24} style={{ marginBottom: 24 }}>
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          padding: "40px 20px", textAlign: "center", gap: 8,
        }}>
          <Cloud size={28} style={{ color: "var(--ink-4)" }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>No Amex data yet</div>
          <div style={{ fontSize: 12, color: "var(--ink-4)" }}>
            Upload a Statement Activity CSV in{" "}
            <Link href="/amex" style={{ color: "var(--accent)" }}>Amex Reconciliation</Link>{" "}
            to populate this dashboard.
          </div>
        </div>
      </Panel>
    );
  }

  const maxVendor = m.topVendors[0]?.total ?? 1;

  return (
    <>
      {/* Metric tiles — derived from SaaS-classified Amex spend */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        <Metric
          label="Total SaaS spend"
          value={`$${Math.round(m.total).toLocaleString()}`}
          sub={`${range.label.toLowerCase()} · ${m.days} day${m.days === 1 ? "" : "s"}`}
          sparkline={<Sparkline values={m.totalSpark} color="var(--ink-2)" width={70} height={28} fill />}
        />
        <Metric
          label="Daily burn"
          value={`$${Math.round(m.burn).toLocaleString()}`}
          sub={`avg over ${m.days} day${m.days === 1 ? "" : "s"}`}
        />
        <Metric
          label="Active vendors"
          value={`${m.vendorCount}`}
          sub={`distinct vendors classified in range`}
        />
        <Metric
          label="Top category"
          value={m.topCategory ? CATEGORY_LABEL[m.topCategory] : "—"}
          sub={m.topCategory
            ? `$${Math.round(m.topCatTotal).toLocaleString()} · ${((m.topCatTotal / m.total) * 100).toFixed(0)}% of total`
            : "no data in range"}
        />
      </div>

      {/* Daily spend area chart — total SaaS spend per day, scoped to active range */}
      <DailySpendChart series={m.series} burn={m.burn} rangeLabel={range.label} />

      {/* Bottom row: Top SaaS vendors + Category mix */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
        <Panel>
          <SectionTitle sub={`By spend in ${range.label.toLowerCase()}`}>Top SaaS vendors</SectionTitle>
          {m.topVendors.length === 0 ? (
            <div style={{ padding: "24px 8px", textAlign: "center", fontSize: 12, color: "var(--ink-4)" }}>
              No vendor spend in this period.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {m.topVendors.map((v, i) => (
                <div
                  key={v.name}
                  style={{ display: "grid", gridTemplateColumns: "20px 1fr auto", gap: 12, alignItems: "center" }}
                >
                  <span className="tnum" style={{ color: "var(--ink-4)", fontSize: 12, fontWeight: 500 }}>
                    {i + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{v.name}</span>
                      <span style={{
                        fontSize: 10, fontWeight: 500, padding: "1px 6px", borderRadius: 999,
                        background: CAT_COLORS[v.category] + "22",
                        color: CAT_COLORS[v.category],
                        textTransform: "uppercase", letterSpacing: ".04em",
                      }}>
                        {CATEGORY_LABEL[v.category]}
                      </span>
                    </div>
                    <div style={{ marginTop: 5, height: 4, borderRadius: 999, background: "var(--panel-2)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%", width: `${(v.total / maxVendor) * 100}%`,
                        background: CAT_COLORS[v.category], borderRadius: 999,
                      }} />
                    </div>
                  </div>
                  <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                    ${Math.round(v.total).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <CategoryMixChart rows={m.byCategory} total={m.total} />
      </div>
    </>
  );
}
