import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { repo } from "@/lib/repo";
import { fmtUSD, fmtNum } from "@/lib/format";
import { parseRange, previousRange, filterByRange, rangeDays } from "@/lib/dateRange";
import { detectAnomalies, anomaliesInRange } from "@/lib/anomalies";
import {
  Panel, PageHeader, Metric, SectionTitle, Avatar, Pill, ProviderTag,
  Th, Td, Sparkline, PROVIDER_HEX,
} from "@/components/ui";
import { DeveloperDetailCharts } from "./DeveloperDetailCharts";

export default async function DeveloperDetail({
  params, searchParams,
}: {
  params:       Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp     = await searchParams;
  const range  = parseRange(sp);
  const prev   = previousRange(range);

  const [devs, keys, usage] = await Promise.all([
    repo.getDevelopers(), repo.getApiKeys(), repo.getUsage(),
  ]);
  const dev = devs.find((d) => d.id === id);
  if (!dev) notFound();

  const myKeys     = keys.filter((k) => k.developer_id === id);
  const myKeyIds   = new Set(myKeys.map((k) => k.id));
  const myUsage    = usage.filter((u) => myKeyIds.has(u.api_key_id));
  const period     = filterByRange(myUsage, range);
  const periodPrev = filterByRange(myUsage, prev);

  const total      = period.reduce((s, r) => s + r.cost_usd, 0);
  const totalPrev  = periodPrev.reduce((s, r) => s + r.cost_usd, 0);
  const inputTok   = period.reduce((s, r) => s + r.input_tokens, 0);
  const outputTok  = period.reduce((s, r) => s + r.output_tokens, 0);
  const days       = rangeDays(range);
  const burn       = total / days;

  /* Daily series for the chart */
  const byDate = new Map<string, { date: string; anthropic: number; openai: number }>();
  for (const u of period) {
    const e = byDate.get(u.date) ?? { date: u.date, anthropic: 0, openai: 0 };
    if (u.provider === "anthropic") e.anthropic += u.cost_usd;
    if (u.provider === "openai")    e.openai    += u.cost_usd;
    byDate.set(u.date, e);
  }
  const series = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));

  /* Per-model breakdown for the period */
  type ModelRow = { model: string; provider: "anthropic" | "openai"; cost: number; input: number; output: number };
  const byModel = new Map<string, ModelRow>();
  for (const u of period) {
    if (u.provider === "amex") continue;
    const e = byModel.get(u.model) ?? { model: u.model, provider: u.provider, cost: 0, input: 0, output: 0 };
    e.cost += u.cost_usd; e.input += u.input_tokens; e.output += u.output_tokens;
    byModel.set(u.model, e);
  }
  const modelRows = [...byModel.values()].sort((a, b) => b.cost - a.cost);

  /* Anomalies for this developer in the selected period */
  const keyToDev = new Map(keys.map((k) => [k.id, k.developer_id]));
  const myAnomalies = anomaliesInRange(detectAnomalies({ rows: usage, keyToDev }), range.from, range.to)
    .filter((a) => a.developerId === id);

  /* 30-day sparkline regardless of range */
  const cutoff = new Date(range.to + "T00:00:00");
  cutoff.setDate(cutoff.getDate() - 29);
  const cutoffISO = cutoff.toISOString().slice(0, 10);
  const last30 = myUsage.filter((u) => u.date >= cutoffISO && u.date <= range.to);
  const sparkByDate = new Map<string, number>();
  for (const u of last30) sparkByDate.set(u.date, (sparkByDate.get(u.date) ?? 0) + u.cost_usd);
  const sparkValues = [...sparkByDate.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);

  const deltaPct = totalPrev > 0 ? ((total - totalPrev) / totalPrev) * 100 : 0;

  return (
    <div>
      {/* Back link */}
      <Link href={`/developers${sp ? "" : ""}`} style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        fontSize: 12, color: "var(--ink-3)", textDecoration: "none",
        marginBottom: 16,
      }}>
        <ChevronLeft size={14} /> All developers
      </Link>

      <PageHeader
        title={dev.name}
        subtitle={`${dev.team ?? "Unassigned"} · ${myKeys.length} API key${myKeys.length === 1 ? "" : "s"} · ${range.label.toLowerCase()}`}
        right={<Pill tone="neutral">{days} day{days === 1 ? "" : "s"}</Pill>}
      />

      {/* Anomaly banner specific to this developer */}
      {myAnomalies.length > 0 && (
        <Panel style={{ marginBottom: 16, background: "var(--warn-soft)", border: "1px solid var(--warn-soft)" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--warn)", marginBottom: 6 }}>
            ⚠ {myAnomalies.length} anomalous day{myAnomalies.length === 1 ? "" : "s"} this period
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: "var(--ink-3)" }}>
            {myAnomalies.map((a) => (
              <span key={a.date}>
                <strong style={{ color: "var(--ink-2)" }}>{a.date}</strong>
                <span style={{ color: "var(--ink-4)" }}> · </span>
                <span className="tnum">${Math.round(a.spend).toLocaleString()} ({a.zScore.toFixed(1)}σ)</span>
              </span>
            ))}
          </div>
        </Panel>
      )}

      {/* Metric tiles */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 24 }}>
        <Metric
          label="Period spend"
          value={`$${Math.round(total).toLocaleString()}`}
          delta={totalPrev > 0 ? `${deltaPct >= 0 ? "+" : ""}${deltaPct.toFixed(1)}%` : undefined}
          deltaTone={deltaPct >= 0 ? "down" : "up"}
          sub={`vs $${Math.round(totalPrev).toLocaleString()} prev period`}
          sparkline={sparkValues.length >= 2
            ? <Sparkline values={sparkValues} color="var(--ink-2)" width={70} height={28} fill />
            : undefined}
        />
        <Metric label="Daily burn" value={`$${Math.round(burn).toLocaleString()}`} sub={`avg over ${days} days`} />
        <Metric label="Input tokens"  value={fmtNum(inputTok)}  sub="prompts to model" />
        <Metric label="Output tokens" value={fmtNum(outputTok)} sub="completions from model" />
      </div>

      {/* Daily chart */}
      <DeveloperDetailCharts series={series} />

      {/* Per-model breakdown */}
      <Panel padding={0} style={{ overflow: "hidden", marginTop: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <SectionTitle sub="Cost & token usage by model · period total">Model breakdown</SectionTitle>
        </div>
        {modelRows.length > 0 ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <Th>Model</Th>
                <Th>Provider</Th>
                <Th align="right">Input tokens</Th>
                <Th align="right">Output tokens</Th>
                <Th align="right">Cost</Th>
                <Th align="right">% of period</Th>
              </tr>
            </thead>
            <tbody>
              {modelRows.map((r) => (
                <tr key={r.model}>
                  <Td mono style={{ color: "var(--ink)" }}>{r.model}</Td>
                  <Td><ProviderTag provider={r.provider} /></Td>
                  <Td align="right" mono style={{ color: "var(--ink-3)" }}>{fmtNum(r.input)}</Td>
                  <Td align="right" mono style={{ color: "var(--ink-3)" }}>{fmtNum(r.output)}</Td>
                  <Td align="right" mono style={{ fontWeight: 600, color: "var(--ink)" }}>{fmtUSD(r.cost)}</Td>
                  <Td align="right" mono style={{ color: "var(--ink-3)" }}>
                    {total > 0 ? `${((r.cost / total) * 100).toFixed(1)}%` : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ padding: "24px 20px", color: "var(--ink-4)", fontSize: 13 }}>
            No model usage in the selected range.
          </div>
        )}
      </Panel>

      {/* API keys */}
      <Panel padding={0} style={{ overflow: "hidden", marginTop: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <SectionTitle sub={`${myKeys.length} key${myKeys.length === 1 ? "" : "s"} attached to this developer`}>
            API keys
          </SectionTitle>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>Label</Th>
              <Th>Provider</Th>
              <Th>Key prefix</Th>
              <Th align="right">Period spend</Th>
              <Th align="right">Last used</Th>
            </tr>
          </thead>
          <tbody>
            {myKeys.map((k) => {
              const keyUsage = period.filter((u) => u.api_key_id === k.id);
              const keyCost  = keyUsage.reduce((s, u) => s + u.cost_usd, 0);
              const lastUsed = keyUsage.length > 0
                ? keyUsage.map((u) => u.date).sort().pop()
                : null;
              const idle = !lastUsed;
              const prefix = k.external_key_id.length > 12
                ? k.external_key_id.slice(0, 12) + "…"
                : k.external_key_id;
              return (
                <tr key={k.id}>
                  <Td style={{ fontWeight: 500, color: "var(--ink)" }}>{k.label}</Td>
                  <Td>
                    {k.provider === "amex"
                      ? <Pill tone="neutral" size="sm">amex</Pill>
                      : <ProviderTag provider={k.provider} />}
                  </Td>
                  <Td mono style={{ color: "var(--ink-3)" }}>{prefix}</Td>
                  <Td align="right" mono style={{ color: keyCost > 0 ? "var(--ink-2)" : "var(--ink-4)" }}>
                    {keyCost > 0 ? fmtUSD(keyCost) : "—"}
                  </Td>
                  <Td align="right" mono style={{ color: idle ? "var(--ink-4)" : "var(--ink-3)" }}>
                    {lastUsed ?? <Pill tone="warn" size="sm">idle</Pill>}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
