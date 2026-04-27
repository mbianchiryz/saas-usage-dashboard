import { repo } from "@/lib/repo";
import { fmtUSD, fmtNum } from "@/lib/format";
import { mtdRange, prevMonthRange, sumCost, projectMonthEnd, dailySeriesByProvider } from "@/lib/metrics";
import {
  Panel, Metric, PageHeader, SectionTitle, Sparkline,
  Avatar, Pill, PROVIDER_HEX,
} from "@/components/ui";
import { OverviewCharts } from "./OverviewCharts";
import { ProviderMixChart } from "./ProviderMixChart";

export default async function OverviewPage() {
  const [usage, keys, devs] = await Promise.all([
    repo.getUsage(),
    repo.getApiKeys(),
    repo.getDevelopers(),
  ]);

  const mtd  = mtdRange();
  const prev = prevMonthRange();
  const mtdRows  = usage.filter((r) => r.date >= mtd.from  && r.date <= mtd.to);
  const prevRows = usage.filter((r) => r.date >= prev.from && r.date <= prev.to);

  const mtdTotal  = sumCost(mtdRows);
  const mtdAnt    = sumCost(mtdRows, "anthropic");
  const mtdOai    = sumCost(mtdRows, "openai");
  const prevTotal = sumCost(prevRows);
  const projected = projectMonthEnd(mtdTotal);
  const momChange = prevTotal > 0 ? (projected - prevTotal) / prevTotal : 0;

  const cutoff = new Date(mtd.to);
  cutoff.setDate(cutoff.getDate() - 29);
  const last30  = usage.filter((r) => r.date >= cutoff.toISOString().slice(0, 10));
  const series  = dailySeriesByProvider(last30);

  const dayOfMonth = Number(mtd.to.slice(8));
  const burn = mtdTotal / dayOfMonth;

  // Sparklines — last 14 data points
  const totalSpark = series.slice(-14).map((s) => s.anthropic + s.openai);
  const antSpark   = series.slice(-14).map((s) => s.anthropic);
  const oaiSpark   = series.slice(-14).map((s) => s.openai);

  const month = new Date(mtd.to + "T00:00").toLocaleString("en-US", { month: "long", year: "numeric" });

  // Top developers
  const keyById = new Map(keys.map((k) => [k.id, k]));
  const devById = new Map(devs.map((d) => [d.id, d]));
  const byDev   = new Map<string, { id: string; name: string; team: string; total: number }>();
  for (const u of mtdRows) {
    const k = keyById.get(u.api_key_id); if (!k) continue;
    const d = devById.get(k.developer_id); if (!d) continue;
    const row = byDev.get(d.id) ?? { id: d.id, name: d.name, team: d.team ?? "", total: 0 };
    row.total += u.cost_usd;
    byDev.set(d.id, row);
  }
  const topDevs = [...byDev.values()].sort((a, b) => b.total - a.total).slice(0, 6);
  const maxDev  = topDevs[0]?.total ?? 1;

  return (
    <div>
      <PageHeader
        title="Overview"
        scriptAccent="month-to-date"
        subtitle={`Tracking AI spend across Anthropic & OpenAI · as of ${mtd.to}`}
        right={<Pill tone="neutral">{month}</Pill>}
      />

      {/* Metric tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        <Metric
          label="Total spend"
          value={`$${Math.round(mtdTotal).toLocaleString()}`}
          delta={`${((mtdTotal - prevTotal) / Math.max(prevTotal, 1) * 100).toFixed(1)}%`}
          deltaTone={mtdTotal >= prevTotal ? "down" : "up"}
          sub={`vs $${Math.round(prevTotal).toLocaleString()} last mo.`}
          sparkline={<Sparkline values={totalSpark} color="var(--ink-2)" width={70} height={28} fill />}
        />
        <Metric
          label="Anthropic"
          value={`$${Math.round(mtdAnt).toLocaleString()}`}
          sub={`${((mtdAnt / mtdTotal) * 100).toFixed(0)}% of total`}
          sparkline={<Sparkline values={antSpark} color={PROVIDER_HEX.anthropic} width={70} height={28} fill />}
        />
        <Metric
          label="OpenAI"
          value={`$${Math.round(mtdOai).toLocaleString()}`}
          sub={`${((mtdOai / mtdTotal) * 100).toFixed(0)}% of total`}
          sparkline={<Sparkline values={oaiSpark} color={PROVIDER_HEX.openai} width={70} height={28} fill />}
        />
        <Metric
          label="Projected month-end"
          value={`$${Math.round(projected).toLocaleString()}`}
          delta={`${(momChange >= 0 ? "+" : "")}${(momChange * 100).toFixed(1)}%`}
          deltaTone={momChange >= 0 ? "down" : "up"}
          sub="vs last month"
        />
      </div>

      {/* Area chart — client component for recharts */}
      <OverviewCharts series={series} burn={burn} />

      {/* Bottom row: Top devs + Provider mix */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Top developers */}
        <Panel>
          <SectionTitle sub="By month-to-date spend">Top developers</SectionTitle>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {topDevs.map((d, i) => (
              <div key={d.id} style={{ display: "grid", gridTemplateColumns: "20px auto 1fr auto", gap: 12, alignItems: "center" }}>
                <span className="tnum" style={{ color: "var(--ink-4)", fontSize: 12, fontWeight: 500 }}>{i + 1}</span>
                <Avatar name={d.name} size={28} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{d.name}</div>
                  <div style={{ marginTop: 5, height: 4, borderRadius: 999, background: "var(--panel-2)", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(d.total / maxDev) * 100}%`, background: "var(--ink-2)", borderRadius: 999 }} />
                  </div>
                </div>
                <div className="tnum" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
                  ${Math.round(d.total).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <ProviderMixChart ant={mtdAnt} oai={mtdOai} />
      </div>
    </div>
  );
}
