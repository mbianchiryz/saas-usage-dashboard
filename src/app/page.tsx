import Link from "next/link";
import { repo } from "@/lib/repo";
import { supabase } from "@/lib/supabase";
import { sumCost, projectMonthEnd, dailySeriesByProvider, todayStr, mtdRange } from "@/lib/metrics";
import { parseRange, previousRange, filterByRange, rangeDays } from "@/lib/dateRange";
import { detectAnomalies, anomaliesInRange } from "@/lib/anomalies";
import { developerEfficiency } from "@/lib/efficiency";
import { evaluateBudgets, describeScope, type Budget } from "@/lib/budgets";
import {
  Panel, Metric, PageHeader, SectionTitle, Sparkline,
  Avatar, Pill, PROVIDER_HEX,
} from "@/components/ui";
import { AlertTriangle } from "lucide-react";
import { OverviewCharts } from "./OverviewCharts";
import { ProviderMixChart } from "./ProviderMixChart";
import { BurnUpChart, type BurnUpPoint } from "./BurnUpChart";

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

  /* ── Anomalies (>2σ daily spend per developer, full-history baseline) ── */
  const keyToDev      = new Map(keys.map((k) => [k.id, k.developer_id]));
  const allAnomalies  = detectAnomalies({ rows: usage, keyToDev });
  const anomaliesNow  = anomaliesInRange(allAnomalies, range.from, range.to)
                          .map((a) => ({ ...a, dev: devById.get(a.developerId) }))
                          .filter((a) => a.dev)
                          .slice(0, 5);

  /* ── Token efficiency leaderboard for the period ── */
  const efficiency = developerEfficiency(periodRows, keyToDev)
    .filter((e) => e.outputTokens > 100_000)        // ignore noise
    .map((e) => ({ ...e, dev: devById.get(e.developerId) }))
    .filter((e) => e.dev)
    .sort((a, b) => b.costPerMOutput - a.costPerMOutput) // most expensive per token first
    .slice(0, 6);

  /* ── Budgets ── */
  const today = todayStr();
  const { data: budgetsRow } = await supabase
    .from("shared_data").select("value").eq("key", "budgets").single();
  const budgetList: Budget[] = Array.isArray(budgetsRow?.value?.list) ? budgetsRow.value.list : [];
  const evaluations = evaluateBudgets(budgetList, usage, keys, devs, today);
  const breaches    = evaluations.filter((e) => e.status !== "ok");

  /* Pick a global monthly budget for the burn-up chart (if one exists) */
  const burnUpBudget = budgetList.find((b) => b.scope === "global" && b.type === "monthly");
  let burnUpData: BurnUpPoint[] | null = null;
  let burnUpProjected = 0;
  if (burnUpBudget) {
    const { from, to } = mtdRange(today);
    const mtdRows = usage.filter((r) => r.date >= from && r.date <= to);
    const [year, month] = today.split("-").map(Number);
    const totalDays  = new Date(year, month, 0).getDate();
    const todayDay   = Number(today.slice(8));

    /* Aggregate spend per day */
    const byDay = new Map<number, number>();
    for (const r of mtdRows) byDay.set(Number(r.date.slice(8)), (byDay.get(Number(r.date.slice(8))) ?? 0) + r.cost_usd);

    let cumulative = 0;
    burnUpData = [];
    for (let d = 1; d <= totalDays; d++) {
      const target = (burnUpBudget.amount / totalDays) * d;
      if (d <= todayDay) {
        cumulative += byDay.get(d) ?? 0;
        burnUpData.push({ day: String(d).padStart(2, "0"), actual: Number(cumulative.toFixed(2)), target: Number(target.toFixed(2)) });
      } else {
        burnUpData.push({ day: String(d).padStart(2, "0"), actual: null, target: Number(target.toFixed(2)) });
      }
    }
    const mtdTotal = mtdRows.reduce((s, r) => s + r.cost_usd, 0);
    burnUpProjected = projectMonthEnd(mtdTotal, today);
  }

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

      {/* Budget breach banner */}
      {breaches.length > 0 && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "14px 18px", borderRadius: "var(--r-md)",
          border: `1px solid ${breaches.some((b) => b.status === "exceeded") ? "var(--danger-soft)" : "var(--warn-soft)"}`,
          background: breaches.some((b) => b.status === "exceeded") ? "var(--danger-soft)" : "var(--warn-soft)",
          marginBottom: 24,
        }}>
          <AlertTriangle size={16} style={{
            color: breaches.some((b) => b.status === "exceeded") ? "var(--danger)" : "var(--warn)",
            marginTop: 2, flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13, fontWeight: 600, marginBottom: 6,
              color: breaches.some((b) => b.status === "exceeded") ? "var(--danger)" : "var(--warn)",
            }}>
              {breaches.length} budget alert{breaches.length === 1 ? "" : "s"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--ink-3)" }}>
              {breaches.map((b) => (
                <div key={b.budget.id}>
                  <strong style={{ color: "var(--ink-2)" }}>{b.budget.name}</strong>
                  <span style={{ color: "var(--ink-4)" }}> · {describeScope(b.budget, devs)} · </span>
                  <span className="tnum">{b.message}</span>
                  <span style={{
                    marginLeft: 8, padding: "1px 6px", borderRadius: 4,
                    fontSize: 10, fontWeight: 600, textTransform: "uppercase",
                    background: b.status === "exceeded" ? "var(--danger)" : "var(--warn)",
                    color: "#FFF",
                  }}>
                    {b.status === "exceeded" ? `over by ${(b.pctUsed - 100).toFixed(0)}%` : `${b.pctUsed.toFixed(0)}% used`}
                  </span>
                </div>
              ))}
            </div>
            <Link href="/budgets" style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: "var(--ink-3)", textDecoration: "underline" }}>
              Manage budgets →
            </Link>
          </div>
        </div>
      )}

      {/* Anomalies banner */}
      {anomaliesNow.length > 0 && (
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 12,
          padding: "14px 18px", borderRadius: "var(--r-md)",
          border: "1px solid var(--warn-soft)", background: "var(--warn-soft)",
          marginBottom: 24,
        }}>
          <AlertTriangle size={16} style={{ color: "var(--warn)", marginTop: 2, flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--warn)", marginBottom: 4 }}>
              {anomaliesNow.length} spend {anomaliesNow.length === 1 ? "anomaly" : "anomalies"} detected this period
            </div>
            <div style={{ fontSize: 12, color: "var(--ink-3)", display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
              {anomaliesNow.map((a) => (
                <Link key={`${a.developerId}-${a.date}`} href={`/developers/${a.developerId}`}
                      style={{ color: "var(--ink-2)", textDecoration: "none", fontWeight: 500 }}>
                  <span>{a.dev!.name}</span>
                  <span style={{ color: "var(--ink-4)" }}> · {a.date} · </span>
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    ${Math.round(a.spend).toLocaleString()} ({a.zScore.toFixed(1)}σ)
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Area chart — client component for recharts */}
      <OverviewCharts series={series} burn={burn} />

      {/* Budget burn-up chart — only when a global monthly budget exists */}
      {burnUpBudget && burnUpData && (
        <div style={{ marginTop: 16 }}>
          <BurnUpChart
            data={burnUpData}
            budget={burnUpBudget.amount}
            budgetName={burnUpBudget.name}
            projected={burnUpProjected}
          />
        </div>
      )}

      {/* Bottom row: Top devs + Provider mix */}
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 16 }}>
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

      {/* Token efficiency leaderboard */}
      {efficiency.length > 0 && (
        <Panel>
          <SectionTitle sub="Highest $ spent per million output tokens — usually means giant prompts, no caching, or wrong model">
            Token efficiency · who's overpaying
          </SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 4 }}>
            {efficiency.map((e, i) => {
              const max = efficiency[0].costPerMOutput;
              return (
                <Link
                  key={e.developerId}
                  href={`/developers/${e.developerId}`}
                  style={{
                    display: "grid", gridTemplateColumns: "20px auto 1fr auto", gap: 12,
                    alignItems: "center", textDecoration: "none",
                  }}
                >
                  <span className="tnum" style={{ color: "var(--ink-4)", fontSize: 12, fontWeight: 500 }}>{i + 1}</span>
                  <Avatar name={e.dev!.name} size={26} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>
                      {e.dev!.name}
                    </div>
                    <div style={{ marginTop: 4, height: 4, borderRadius: 999, background: "var(--panel-2)", overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(e.costPerMOutput / max) * 100}%`, background: "var(--warn)", borderRadius: 999 }} />
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="tnum" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                      ${e.costPerMOutput.toFixed(2)}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--ink-4)", marginTop: 1 }}>per 1M out</div>
                  </div>
                </Link>
              );
            })}
          </div>
        </Panel>
      )}
    </div>
  );
}
