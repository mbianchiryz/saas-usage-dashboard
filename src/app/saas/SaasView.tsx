"use client";
import { useEffect, useMemo, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, Search, X } from "lucide-react";
import Link from "next/link";
import { parseAmexCsv, type AmexRow } from "@/lib/amex-parser";
import { normaliseStore, type AmexStore } from "@/lib/amex-merge";
import { classifySaas, CATEGORY_LABEL, type SaasCategory } from "@/lib/saas-classifier";
import type { SaasVendor } from "@/lib/saas-vendors";
import { Panel, PageHeader, SectionTitle, Pill, Metric } from "@/components/ui";
import { fmtUSD } from "@/lib/format";

const SHARED_KEY     = "amex_csv";
const LS_KEY_STORE   = "amex_store_v2";

interface PivotRow {
  name:       string;
  category:   SaasCategory;
  byMonth:    Record<string, number>;
  total:      number;
  inCatalog:  boolean;
  expected?:  number;
}

function shortMonth(ym: string): string {
  const [y, m] = ym.split("-");
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString("en-US", { month: "short", year: "2-digit" });
}

export function SaasView() {
  const [rows,        setRows]        = useState<AmexRow[] | null>(null);
  const [fileName,    setFileName]    = useState<string | null>(null);
  const [userVendors, setUserVendors] = useState<SaasVendor[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [activeCat,   setActiveCat]   = useState<SaasCategory | "all">("all");

  /* Load vendors + Amex store (Supabase first, fall back to localStorage). */
  useEffect(() => {
    async function load() {
      try {
        const [csvRes, vendorRes] = await Promise.all([
          fetch(`/api/shared?key=${SHARED_KEY}`).then((r) => r.json()).catch(() => ({ data: null })),
          fetch(`/api/saas-vendors`).then((r) => r.json()).catch(() => ({ vendors: [] })),
        ]);

        let store: AmexStore | null = null;
        if (csvRes?.data) store = normaliseStore(csvRes.data, parseAmexCsv);

        if (!store || store.rows.length === 0) {
          const lsRaw = typeof window !== "undefined" ? localStorage.getItem(LS_KEY_STORE) : null;
          if (lsRaw) {
            try {
              const parsed = JSON.parse(lsRaw) as AmexStore;
              if (Array.isArray(parsed.rows) && parsed.rows.length > 0) store = parsed;
            } catch { /* ignore */ }
          }
        }

        /* Migration from old single-CSV localStorage format */
        if (!store || store.rows.length === 0) {
          const oldCsv  = typeof window !== "undefined" ? localStorage.getItem("amex_csv_text")     : null;
          const oldName = typeof window !== "undefined" ? localStorage.getItem("amex_csv_filename") : null;
          if (oldCsv) {
            const { rows: oldRows } = parseAmexCsv(oldCsv);
            if (oldRows.length > 0) {
              store = {
                rows:    oldRows,
                history: [{
                  fileName:   oldName ?? "imported.csv",
                  uploadedAt: new Date().toISOString(),
                  total:      oldRows.length,
                  added:      oldRows.length,
                  duplicates: 0,
                }],
              };
            }
          }
        }

        if (store && store.rows.length > 0) {
          setRows(store.rows);
          setFileName(store.history[0]?.fileName ?? null);
        }
        setUserVendors(Array.isArray(vendorRes.vendors) ? vendorRes.vendors : []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const pivot = useMemo(() => {
    if (!rows) return null;
    const nonAi = rows.filter((r) => r.provider === null);

    const catalogNames = new Set(userVendors.map((v) => v.name));
    const monthSet     = new Set<string>();
    const groups       = new Map<string, PivotRow>();

    for (const row of nonAi) {
      const ym = row.date.slice(0, 7);
      monthSet.add(ym);
      const cls = classifySaas(row.description, userVendors);
      const expected = userVendors.find((v) => v.name === cls.name)?.expectedMonthly;
      const entry = groups.get(cls.name) ?? {
        name:      cls.name,
        category:  cls.category,
        byMonth:   {},
        total:     0,
        inCatalog: catalogNames.has(cls.name),
        expected,
      };
      entry.byMonth[ym] = (entry.byMonth[ym] ?? 0) + row.amount;
      entry.total      += row.amount;
      groups.set(cls.name, entry);
    }

    const months    = Array.from(monthSet).sort();
    const allRows   = Array.from(groups.values()).sort((a, b) => b.total - a.total);
    const inCatalog = allRows.filter((r) => r.inCatalog);

    const inCatalogTotal = inCatalog.reduce((s, r) => s + r.total, 0);
    const monthTotals    = Object.fromEntries(months.map((m) => [m, inCatalog.reduce((s, r) => s + (r.byMonth[m] ?? 0), 0)]));

    return { inCatalog, months, monthTotals, inCatalogTotal };
  }, [rows, userVendors]);

  if (loading) {
    return (
      <div>
        <PageHeader title="SaaS subscriptions" subtitle="Total per vendor across the uploaded Amex CSV" />
        <Panel><p style={{ fontSize: 13, color: "var(--ink-4)" }}>Loading…</p></Panel>
      </div>
    );
  }

  if (!rows || !pivot) {
    return (
      <div>
        <PageHeader title="SaaS subscriptions" subtitle="Total per vendor across the uploaded Amex CSV" />
        <Panel>
          <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 8 }}>No Amex CSV loaded yet.</p>
          <p style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 16 }}>
            Upload your statement on the <Link href="/amex" style={{ color: "var(--accent)" }}>Amex Reconciliation</Link> tab,
            then come back here to see the SaaS pivot.
          </p>
          <p style={{ fontSize: 12, color: "var(--ink-4)" }}>
            You can pre-define vendors on the <Link href="/budgets" style={{ color: "var(--accent)" }}>Budgets</Link> tab
            so charges land under the canonical name you prefer.
          </p>
        </Panel>
      </div>
    );
  }

  const { inCatalog, months, monthTotals, inCatalogTotal } = pivot;

  const allCategories = useMemo(() => {
    const cats = new Set(inCatalog.map((r) => r.category));
    return Array.from(cats).sort();
  }, [inCatalog]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inCatalog.filter((r) => {
      const matchSearch = !q || r.name.toLowerCase().includes(q);
      const matchCat    = activeCat === "all" || r.category === activeCat;
      return matchSearch && matchCat;
    });
  }, [inCatalog, search, activeCat]);

  const filteredTotal    = filtered.reduce((s, r) => s + r.total, 0);
  const filteredMonthTotals = Object.fromEntries(
    months.map((m) => [m, filtered.reduce((s, r) => s + (r.byMonth[m] ?? 0), 0)])
  );
  const isFiltered = search.trim() !== "" || activeCat !== "all";

  return (
    <div>
      <PageHeader
        title="SaaS subscriptions"
        subtitle={`${inCatalog.length} vendors across ${months.length} month${months.length === 1 ? "" : "s"} · CSV: ${fileName ?? "—"}`}
        right={<Pill tone="neutral">${Math.round(inCatalogTotal).toLocaleString()} total</Pill>}
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 24 }}>
        <Metric label="Total spend" value={`$${Math.round(inCatalogTotal).toLocaleString()}`} sub={`${months.length} month${months.length === 1 ? "" : "s"}`} />
        <Metric label="Monthly avg" value={`$${months.length > 0 ? Math.round(inCatalogTotal / months.length).toLocaleString() : 0}`} sub="across catalog SaaS" />
        <Metric label="Vendors"     value={`${inCatalog.length}`} sub="in catalog" />
      </div>

      <Panel padding={0} style={{ overflow: "hidden", marginBottom: 16 }}>
        {/* Filters row */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--line)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
          {/* Search box */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--ink-4)", pointerEvents: "none" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor…"
              style={{
                paddingLeft: 28, paddingRight: search ? 28 : 10, paddingTop: 6, paddingBottom: 6,
                fontSize: 13, border: "1px solid var(--line)", borderRadius: "var(--r-sm)",
                background: "var(--panel-2)", color: "var(--ink)", outline: "none", width: 180,
              }}
            />
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--ink-4)", padding: 0, lineHeight: 1 }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {(["all", ...allCategories] as (SaasCategory | "all")[]).map((c) => {
              const active = activeCat === c;
              return (
                <button key={c} onClick={() => setActiveCat(c)} style={{
                  padding: "4px 12px", fontSize: 12, fontWeight: 500, cursor: "pointer",
                  borderRadius: 999, border: `1px solid ${active ? "var(--ink)" : "var(--line)"}`,
                  background: active ? "var(--ink)" : "var(--panel-2)",
                  color:      active ? "var(--bg)"  : "var(--ink-3)",
                  transition: "background .12s, color .12s",
                }}>
                  {c === "all" ? "All" : CATEGORY_LABEL[c]}
                </button>
              );
            })}
          </div>

          {isFiltered && (
            <button onClick={() => { setSearch(""); setActiveCat("all"); }} style={{ fontSize: 12, color: "var(--ink-4)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              Clear filters
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px", borderBottom: "1px solid var(--line)" }}>
          <SectionTitle sub="Vendors registered in the catalog (manage on the Budgets tab)">
            {isFiltered
              ? `${filtered.length} of ${inCatalog.length} vendor${inCatalog.length === 1 ? "" : "s"}`
              : `Catalog · ${inCatalog.length} vendor${inCatalog.length === 1 ? "" : "s"}`}
          </SectionTitle>
          <Link href="/budgets" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
            Manage catalog →
          </Link>
        </div>
        <PivotTable rows={filtered} months={months} grandTotal={filteredTotal} monthTotals={filteredMonthTotals}
          showExpected emptyMessage={isFiltered ? "No vendors match the current filters." : "No catalog vendors with charges in this CSV yet. Add some on the Budgets tab."} />
      </Panel>

    </div>
  );
}

type SortKey = string; // "name" | "category" | "total" | "variance" | `m:${ym}`
type SortDir = "asc" | "desc";

function PivotTable({
  rows, months, grandTotal, monthTotals, showExpected, emptyMessage,
}: {
  rows: PivotRow[];
  months: string[];
  grandTotal: number;
  monthTotals: Record<string, number>;
  showExpected?: boolean;
  emptyMessage: string;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(key: SortKey, defaultDir: SortDir = "asc") {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir(defaultDir); }
  }

  const sortedRows = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      if (sortKey === "name")          { va = a.name.toLowerCase();             vb = b.name.toLowerCase(); }
      else if (sortKey === "category") { va = CATEGORY_LABEL[a.category];        vb = CATEGORY_LABEL[b.category]; }
      else if (sortKey === "total")    { va = a.total;                          vb = b.total; }
      else if (sortKey === "variance") {
        const avgA = months.length > 0 ? a.total / months.length : 0;
        const avgB = months.length > 0 ? b.total / months.length : 0;
        va = a.expected ? avgA - a.expected : -Infinity;
        vb = b.expected ? avgB - b.expected : -Infinity;
      } else if (sortKey.startsWith("m:")) {
        const m = sortKey.slice(2);
        va = a.byMonth[m] ?? 0;
        vb = b.byMonth[m] ?? 0;
      } else { va = 0; vb = 0; }

      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1  : -1;
      return 0;
    });
    return arr;
  }, [rows, sortKey, sortDir, months]);

  if (rows.length === 0) {
    return <div style={{ padding: "24px 20px", color: "var(--ink-4)", fontSize: 13 }}>{emptyMessage}</div>;
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <ArrowUpDown size={11} style={{ opacity: 0.35, marginLeft: 4, verticalAlign: "middle" }} />;
    return sortDir === "asc"
      ? <ArrowUp size={11} style={{ marginLeft: 4, verticalAlign: "middle", color: "var(--ink)" }} />
      : <ArrowDown size={11} style={{ marginLeft: 4, verticalAlign: "middle", color: "var(--ink)" }} />;
  }

  const sortableTh = (label: string, key: SortKey, alignRight = false, defaultDir: SortDir = "asc"): React.ReactNode => (
    <th
      key={key}
      onClick={() => toggleSort(key, defaultDir)}
      style={{
        ...th,
        textAlign: alignRight ? "right" : "left",
        minWidth: alignRight ? 90 : undefined,
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {label}<SortIcon k={key} />
    </th>
  );

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {sortableTh("Vendor",   "name")}
            {sortableTh("Category", "category")}
            {months.map((m) => sortableTh(shortMonth(m), `m:${m}`, true, "desc"))}
            {sortableTh("Total",    "total", true, "desc")}
            {showExpected && sortableTh("Variance", "variance", true, "desc")}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((r) => {
            const monthlyAvg  = months.length > 0 ? r.total / months.length : 0;
            const variance    = r.expected ? monthlyAvg - r.expected : null;
            const variancePct = r.expected && r.expected > 0 ? ((monthlyAvg - r.expected) / r.expected) * 100 : null;
            return (
              <tr key={r.name}>
                <td style={tdCell}><span style={{ fontWeight: 500, color: "var(--ink)" }}>{r.name}</span></td>
                <td style={tdCell}><Pill tone="neutral" size="sm">{CATEGORY_LABEL[r.category]}</Pill></td>
                {months.map((m) => {
                  const v = r.byMonth[m];
                  return (
                    <td key={m} style={{ ...tdCell, textAlign: "right", fontFamily: "var(--font-mono, monospace)", color: v ? "var(--ink-2)" : "var(--ink-4)" }}>
                      {v ? fmtUSD(v) : "—"}
                    </td>
                  );
                })}
                <td style={{ ...tdCell, textAlign: "right", fontFamily: "var(--font-mono, monospace)", fontWeight: 600, color: "var(--ink)" }}>
                  {fmtUSD(r.total)}
                </td>
                {showExpected && (
                  <td style={{ ...tdCell, textAlign: "right", fontFamily: "var(--font-mono, monospace)" }}>
                    {variance == null
                      ? <span style={{ color: "var(--ink-4)" }}>—</span>
                      : (
                        <span style={{
                          color: Math.abs(variancePct ?? 0) > 10
                            ? variance > 0 ? "var(--danger)" : "var(--accent)"
                            : "var(--ink-3)",
                          fontWeight: Math.abs(variancePct ?? 0) > 10 ? 600 : 500,
                        }}>
                          {variance > 0 ? "+" : ""}{fmtUSD(variance)}
                          {variancePct != null && (
                            <span style={{ color: "var(--ink-4)", fontWeight: 400, marginLeft: 4 }}>
                              ({variancePct > 0 ? "+" : ""}{variancePct.toFixed(0)}%)
                            </span>
                          )}
                        </span>
                      )}
                  </td>
                )}
              </tr>
            );
          })}
          <tr style={{ background: "var(--panel-2)" }}>
            <td style={{ ...tdCell, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", fontSize: 11, letterSpacing: ".04em" }}>
              Monthly total
            </td>
            <td style={tdCell}>—</td>
            {months.map((m) => (
              <td key={m} style={{ ...tdCell, textAlign: "right", fontFamily: "var(--font-mono, monospace)", fontWeight: 600, color: "var(--ink)" }}>
                {fmtUSD(monthTotals[m] ?? 0)}
              </td>
            ))}
            <td style={{ ...tdCell, textAlign: "right", fontFamily: "var(--font-mono, monospace)", fontWeight: 700, color: "var(--ink)" }}>
              {fmtUSD(grandTotal)}
            </td>
            {showExpected && <td style={tdCell}></td>}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 16px", textAlign: "left",
  fontSize: 11, fontWeight: 500, letterSpacing: ".04em", textTransform: "uppercase",
  color: "var(--ink-4)", borderBottom: "1px solid var(--line)", background: "var(--panel)",
  whiteSpace: "nowrap",
};
const tdCell: React.CSSProperties = {
  padding: "12px 16px", fontSize: 13, color: "var(--ink-2)",
  borderBottom: "1px solid var(--line)",
};
