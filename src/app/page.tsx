import { repo } from "@/lib/repo";
import { fmtNum } from "@/lib/format";
import { sumCost, projectMonthEnd, dailySeriesByProvider } from "@/lib/metrics";
import { parseRange, previousRange, filterByRange, rangeDays } from "@/lib/dateRange";
import {
  Panel, Metric, PageHeader, SectionTitle, Sparkline,
  Avatar, Pill, PROVIDER_HEX,
} from "@/components/ui";
import { OverviewCharts } from "./OverviewCharts";
import { ProviderMixChart } from "./ProviderMixChart";

export default async function OverviewPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const range = parseRange(sp);
  const prev  = previousRange(range);

  const [usage, keys, devs] = await Promise.all([
    repo.getUsage(),
    repo.getApiKeys(),
    repo.getDevelopers(),
  ]);

  const periodRows = filterByRange(usage, range);
  const prevRows   = filterByRange(usage, prev);

  const periodTotal = sumCost(periodRows);
  const periodAnt   = sumCost(periodRows, "anthropic");
  const periodOai   = sumCost(periodRows, "openai");
  const prevTotal   = sumCost(prevRows);

  /* Projection only makes sense for in-progress periods (preset = mtd, qtd, ytd) */
  const isProjectable = range.preset === "mtd" || range.preset === "qtd" || range.preset === "ytd";
  const days          = rangeDays(range);
  const projected     = isProjectable ? projectMonthEnd(periodTotal, range.to) : periodTotal;
  const momChange     = prevTotal > 0 ? ((isProjectable ? projected : periodTotal) - prevTotal) / prevTotal : 0;

  /* 30-day rolling window for the area chart — independent of picker */
  const cutoff = new Date(range.to + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - 29);
  const last30  = usage.filter((r) => r.date >= cutoff.toISOString().slice(0, 10) && r.date <= range.to);
  const series  = dailySeriesByProvider(last30);

  const burn = periodTotal / days;

  // Sparklines — last 14 data points
  const totalSpark = series.slice(-14).map((s) => s.anthropic + s.openai);
  const antSpark   = series.slice(-14).map((s) => s.anthropic);
  const oaiSpark   = series.slice(-14).map((s) => s.openai);

  // Top developers
  const keyById = new Map(keys.map((k) => [k.id, k]));
  const devById = new Map(devs.map((d) => [d.id, d]));
  const byDev   = new Map<string, { id: string; name: string; team: string; total: number }>();
  for (const u of periodRows) {
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
        scriptAccent={range.label.toLowerCase()}
        subtitle={`Tracking AI spend across Anthropic & OpenAI · ${range.from} → ${range.to}`}
        right={<Pill tone="neutral">{days} day{days === 1 ? "" : "s"}</Pill>}
      />

      {/* Metric tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        <Metric
          label="Total spend"
          value={`$${Math.round(periodTotal).toLocaleString()}`}
          delta={`${((periodTotal - prevTotal) / Math.max(prevTotal, 1) * 100).toFixed(1)}%`}
          deltaTone={periodTotal >= prevTotal ? "down" : "up"}
          sub={`vs $${Math.round(prevTotal).toLocaleString()} prev period`}
          sparkline={<Sparkline values={totalSpark} color="var(--ink-2)" width={70} height={28} fill />}
        />
        <Metric
          label="Anthropic"
          value={`$${Math.round(periodAnt).toLocaleString()}`}
          sub={`${periodTotal > 0 ? ((periodAnt / periodTotal) * 100).toFixed(0) : 0}% of total`}
          sparkline={<Sparkline values={antSpark} color={PROVIDER_HEX.anthropic} width={70} height={28} fill />}
        />
        <Metric
          label="OpenAI"
          value={`$${Math.round(periodOai).toLocaleString()}`}
          sub={`${periodTotal > 0 ? ((periodOai / periodTotal) * 100).toFixed(0) : 0}% of total`}
          sparkline={<Sparkline values={oaiSpark} color={PROVIDER_HEX.openai} width={70} height={28} fill />}
        />
        <Metric
          label={isProjectable ? "Projected period-end" : "Daily burn"}
          value={isProjectable
            ? `$${Math.round(projected).toLocaleString()}`
            : `$${Math.round(burn).toLocaleString()}`}
          delta={isProjectable ? `${(momChange >= 0 ? "+" : "")}${(momChange * 100).toFixed(1)}%` : undefined}
          deltaTone={isProjectable ? (momChange >= 0 ? "down" : "up") : undefined}
          sub={isProjectable ? "vs prev period" : `avg over ${days} days`}
        />
      </div>

      {/* Area chart — client component for recharts */}
      <OverviewCharts series={series} burn={burn} />

      {/* Bottom row: Top devs + Provider mix */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16 }}>
        {/* Top developers */}
        <Panel>
          <SectionTitle sub={`By spend in ${range.label.toLowerCase()}`}>Top developers</SectionTitle>
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

        <ProviderMixChart ant={periodAnt} oai={periodOai} />
      </div>
    </div>
  );
}
