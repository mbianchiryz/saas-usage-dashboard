import { repo } from "@/lib/repo";
import { fmtUSD, fmtPct } from "@/lib/format";
import { Panel, PageHeader, Metric, SectionTitle, ProviderTag, Pill, Sparkline, Th, Td, PROVIDER_HEX } from "@/components/ui";
import { AmexClientSection } from "./AmexClientSection";

export default async function AmexPage() {
  const [charges, usage] = await Promise.all([
    repo.getAmexCharges(),
    repo.getUsage(),
  ]);

  const apiByMonthProvider = new Map<string, number>();
  for (const u of usage) {
    if (u.provider === "amex") continue;
    const key = `${u.date.slice(0, 7)}|${u.provider}`;
    apiByMonthProvider.set(key, (apiByMonthProvider.get(key) ?? 0) + u.cost_usd);
  }

  type Recon = { month: string; provider: string; api: number; amex: number; delta: number; deltaPct: number; chargeDate: string };
  const recon: Recon[] = [];
  for (const c of charges) {
    if (!c.provider_matched) continue;
    const chargeMonth = c.date.slice(0, 7);
    const [y, m] = chargeMonth.split("-").map(Number);
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const usageMonth = `${prevY}-${String(prevM).padStart(2, "0")}`;
    const api = apiByMonthProvider.get(`${usageMonth}|${c.provider_matched}`) ?? 0;
    const delta = c.amount_usd - api;
    recon.push({ month: usageMonth, provider: c.provider_matched, api, amex: c.amount_usd, delta, deltaPct: api > 0 ? delta / api : 0, chargeDate: c.date });
  }
  recon.sort((a, b) => b.month.localeCompare(a.month));

  const totalApi   = recon.reduce((s, r) => s + r.api,  0);
  const totalAmex  = recon.reduce((s, r) => s + r.amex, 0);
  const totalDelta = totalAmex - totalApi;
  const totalVar   = totalApi > 0 ? totalDelta / totalApi : 0;

  /* Variance trend per provider — chronological sequence of monthly delta% values */
  const trendByProvider = new Map<string, number[]>();
  const reconChrono = [...recon].sort((a, b) => a.month.localeCompare(b.month));
  for (const r of reconChrono) {
    const arr = trendByProvider.get(r.provider) ?? [];
    arr.push(r.deltaPct * 100); // express as percent for the sparkline
    trendByProvider.set(r.provider, arr);
  }

  return (
    <div>
      <PageHeader
        title="Amex reconciliation"
        subtitle="Compare provider-reported usage against Amex charges"
      />

      {/* CSV Upload Section */}
      <div style={{ marginBottom: 32 }}>
        <AmexClientSection />
      </div>

      {/* Mock baseline */}
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "var(--ink)", letterSpacing: "-0.015em" }}>
            Mock baseline
          </h2>
          <Pill tone="neutral" size="sm">Simulated data · replace with real API</Pill>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 20 }}>
          <Metric label="API reported" value={`$${Math.round(totalApi).toLocaleString()}`} sub="Provider-reported usage costs" />
          <Metric label="Amex billed"  value={`$${Math.round(totalAmex).toLocaleString()}`} sub="Charges on company card" />
          <Metric
            label="Variance"
            value={`$${Math.round(Math.abs(totalDelta)).toLocaleString()}`}
            delta={fmtPct(totalVar)}
            deltaTone={Math.abs(totalVar) > 0.02 ? "down" : "neutral"}
            sub={totalDelta > 0 ? "overcharged" : "undercharged"}
          />
        </div>

        <Panel padding={0} style={{ overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
            <SectionTitle sub="Provider charges vs API usage · last 3 months">Monthly reconciliation</SectionTitle>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>Usage month</Th>
                <Th>Provider</Th>
                <Th>Charged</Th>
                <Th align="right">API reported</Th>
                <Th align="right">Amex billed</Th>
                <Th align="right">Delta</Th>
                <Th align="right">Variance</Th>
                <Th align="right">Trend</Th>
              </tr>
            </thead>
            <tbody>
              {recon.map((r, i) => {
                const flag = Math.abs(r.deltaPct) > 0.02;
                const trend = trendByProvider.get(r.provider) ?? [];
                const sustained = trend.length >= 3 && trend.slice(-3).every((v) => Math.abs(v) > 2);
                return (
                  <tr key={i}>
                    <Td style={{ fontWeight: 500, color: "var(--ink)" }}>
                      {new Date(r.month + "-01").toLocaleString("en-US", { month: "long", year: "numeric" })}
                    </Td>
                    <Td><ProviderTag provider={r.provider as "anthropic" | "openai"} /></Td>
                    <Td mono style={{ color: "var(--ink-3)" }}>{r.chargeDate}</Td>
                    <Td align="right" mono>{fmtUSD(r.api)}</Td>
                    <Td align="right" mono>{fmtUSD(r.amex)}</Td>
                    <Td align="right" mono style={{ fontWeight: 600, color: r.delta > 0 ? "var(--danger)" : "var(--accent)" }}>
                      {r.delta >= 0 ? "+" : ""}{fmtUSD(r.delta)}
                    </Td>
                    <Td align="right">
                      <Pill tone={flag ? "danger" : "accent"} size="sm">{fmtPct(r.deltaPct)}</Pill>
                    </Td>
                    <Td align="right">
                      {trend.length >= 2 ? (
                        <div
                          title={sustained
                            ? `Sustained variance over ${trend.length} months — likely measurement issue`
                            : `Variance % over the last ${trend.length} months`}
                          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                        >
                          <Sparkline
                            values={trend}
                            color={sustained ? "var(--danger)" : PROVIDER_HEX[r.provider as "anthropic" | "openai"]}
                            width={64}
                            height={20}
                            fill={false}
                          />
                          <span style={{
                            fontSize: 10, color: sustained ? "var(--danger)" : "var(--ink-4)",
                            fontWeight: sustained ? 600 : 400,
                          }}>
                            {trend.length}m
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--ink-4)" }}>—</span>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Panel>
      </div>
    </div>
  );
}
