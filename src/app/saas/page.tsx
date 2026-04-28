import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { parseAmexCsv } from "@/lib/amex-parser";
import { classifySaas, CATEGORY_LABEL, type SaasCategory } from "@/lib/saas-classifier";
import type { SaasVendor } from "@/lib/saas-vendors";
import { Panel, PageHeader, SectionTitle, Pill, Metric } from "@/components/ui";
import { fmtUSD } from "@/lib/format";
import { SaasAddToCatalog } from "./SaasAddToCatalog";

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

export default async function SaasPage() {
  /* Pull both the CSV and the user-defined vendor catalog */
  const [csvRow, vendorsRow] = await Promise.all([
    supabase.from("shared_data").select("value").eq("key", "amex_csv").single(),
    supabase.from("shared_data").select("value").eq("key", "saas_vendors").single(),
  ]);

  const csvText  = (csvRow.data as { value?: { csvText?: string } } | null)?.value?.csvText ?? null;
  const fileName = (csvRow.data as { value?: { fileName?: string } } | null)?.value?.fileName ?? null;
  const userVendors: SaasVendor[] = Array.isArray((vendorsRow.data as { value?: { list?: SaasVendor[] } } | null)?.value?.list)
    ? ((vendorsRow.data as { value?: { list?: SaasVendor[] } }).value!.list as SaasVendor[])
    : [];

  /* Empty state — no CSV yet */
  if (!csvText) {
    return (
      <div>
        <PageHeader
          title="SaaS subscriptions"
          subtitle="Total per vendor across the uploaded Amex CSV"
        />
        <Panel>
          <p style={{ fontSize: 14, color: "var(--ink-2)", marginBottom: 8 }}>
            No Amex CSV loaded yet.
          </p>
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

  const parsed = parseAmexCsv(csvText);
  const nonAi  = parsed.rows.filter((r) => r.provider === null);

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
  const detected  = allRows.filter((r) => !r.inCatalog);

  const grandTotal      = allRows.reduce((s, r) => s + r.total, 0);
  const monthTotals     = Object.fromEntries(months.map((m) => [m, allRows.reduce((s, r) => s + (r.byMonth[m] ?? 0), 0)]));
  const monthlyAvg      = months.length > 0 ? grandTotal / months.length : 0;
  const detectedTotal   = detected.reduce((s, r) => s + r.total, 0);
  const inCatalogTotal  = inCatalog.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <PageHeader
        title="SaaS subscriptions"
        subtitle={`${allRows.length} vendors across ${months.length} month${months.length === 1 ? "" : "s"} · CSV: ${fileName ?? "—"}`}
        right={<Pill tone="neutral">${Math.round(grandTotal).toLocaleString()} total</Pill>}
      />

      {/* Tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        <Metric label="Total spend"      value={`$${Math.round(grandTotal).toLocaleString()}`} sub={`${months.length} month${months.length === 1 ? "" : "s"}`} />
        <Metric label="Monthly avg"      value={`$${Math.round(monthlyAvg).toLocaleString()}`} sub="across all SaaS" />
        <Metric label="In catalog"       value={`${inCatalog.length}`} sub={`$${Math.round(inCatalogTotal).toLocaleString()}`} />
        <Metric label="Auto-detected"    value={`${detected.length}`} sub={`$${Math.round(detectedTotal).toLocaleString()} · not yet in catalog`} />
      </div>

      {/* Catalog vendors pivot */}
      <Panel padding={0} style={{ overflow: "hidden", marginBottom: 16 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "16px 20px", borderBottom: "1px solid var(--line)",
        }}>
          <SectionTitle sub="Vendors registered in the catalog (manage on the Budgets tab)">
            Catalog · {inCatalog.length} vendor{inCatalog.length === 1 ? "" : "s"}
          </SectionTitle>
          <Link href="/budgets" style={{ fontSize: 12, color: "var(--accent)", textDecoration: "none" }}>
            Manage catalog →
          </Link>
        </div>

        <PivotTable rows={inCatalog} months={months} grandTotal={inCatalogTotal} monthTotals={monthTotals}
          showExpected emptyMessage="No catalog vendors with charges in this CSV yet. Add some on the Budgets tab." />
      </Panel>

      {/* Auto-detected vendors */}
      {detected.length > 0 && (
        <Panel padding={0} style={{ overflow: "hidden" }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 20px", borderBottom: "1px solid var(--line)",
          }}>
            <SectionTitle sub="Found in the CSV but not yet registered as vendors. Add to catalog to lock the canonical name + category.">
              Auto-detected · {detected.length}
            </SectionTitle>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={th}>Vendor</th>
                  <th style={th}>Category</th>
                  {months.map((m) => <th key={m} style={{ ...th, textAlign: "right", minWidth: 90 }}>{shortMonth(m)}</th>)}
                  <th style={{ ...th, textAlign: "right", minWidth: 110 }}>Total</th>
                  <th style={{ ...th, textAlign: "right", minWidth: 130 }}></th>
                </tr>
              </thead>
              <tbody>
                {detected.map((r) => (
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
                    <td style={{ ...tdCell, textAlign: "right" }}>
                      <SaasAddToCatalog name={r.name} category={r.category} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ─── Pivot table (catalog) ───────────────────────────────────────────────── */
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
  if (rows.length === 0) {
    return <div style={{ padding: "24px 20px", color: "var(--ink-4)", fontSize: 13 }}>{emptyMessage}</div>;
  }
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={th}>Vendor</th>
            <th style={th}>Category</th>
            {months.map((m) => <th key={m} style={{ ...th, textAlign: "right", minWidth: 90 }}>{shortMonth(m)}</th>)}
            <th style={{ ...th, textAlign: "right", minWidth: 110 }}>Total</th>
            {showExpected && <th style={{ ...th, textAlign: "right", minWidth: 110 }}>Variance</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const monthlyAvg = months.length > 0 ? r.total / months.length : 0;
            const variance   = r.expected ? monthlyAvg - r.expected : null;
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
