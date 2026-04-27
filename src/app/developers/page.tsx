import { repo } from "@/lib/repo";
import { fmtUSD } from "@/lib/format";
import { mtdRange } from "@/lib/metrics";
import { Panel, PageHeader, Pill, Avatar, RatioBar, Th, Td } from "@/components/ui";

export default async function DevelopersPage() {
  const [usage, keys, devs] = await Promise.all([
    repo.getUsage(),
    repo.getApiKeys(),
    repo.getDevelopers(),
  ]);

  const { from, to } = mtdRange();
  const mtdRows = usage.filter((r) => r.date >= from && r.date <= to);
  const keyById = new Map(keys.map((k) => [k.id, k]));
  const devById = new Map(devs.map((d) => [d.id, d]));

  type Row = { id: string; name: string; team: string; anthropic: number; openai: number; total: number };
  const byDev = new Map<string, Row>();
  for (const u of mtdRows) {
    const k = keyById.get(u.api_key_id); if (!k) continue;
    const d = devById.get(k.developer_id); if (!d) continue;
    const row = byDev.get(d.id) ?? { id: d.id, name: d.name, team: d.team ?? "", anthropic: 0, openai: 0, total: 0 };
    if (u.provider === "anthropic") row.anthropic += u.cost_usd;
    if (u.provider === "openai")    row.openai    += u.cost_usd;
    row.total += u.cost_usd;
    byDev.set(d.id, row);
  }
  const rows      = [...byDev.values()].sort((a, b) => b.total - a.total);
  const maxTotal  = Math.max(...rows.map((r) => r.total), 1);
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <PageHeader
        title="By developer"
        subtitle={`${rows.length} active developers · month-to-date`}
        right={
          <>
            <Pill tone="neutral">${Math.round(grandTotal).toLocaleString()} total</Pill>
          </>
        }
      />

      <Panel padding={0} style={{ overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <Th>#</Th>
              <Th>Developer</Th>
              <Th>Team</Th>
              <Th align="right">Anthropic</Th>
              <Th align="right">OpenAI</Th>
              <Th align="right">Total</Th>
              <Th>Mix</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <Td style={{ color: "var(--ink-4)", width: 48 }}>{i + 1}</Td>
                <Td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Avatar name={r.name} size={28} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-4)" }}>
                        {r.name.toLowerCase().replace(/\s+/g, ".")}@company.com
                      </div>
                    </div>
                  </div>
                </Td>
                <Td>
                  <Pill tone="neutral" size="sm">{r.team}</Pill>
                </Td>
                <Td align="right" mono style={{ color: r.anthropic > 0 ? "var(--ink-2)" : "var(--ink-4)" }}>
                  {r.anthropic > 0 ? fmtUSD(r.anthropic) : "—"}
                </Td>
                <Td align="right" mono style={{ color: r.openai > 0 ? "var(--ink-2)" : "var(--ink-4)" }}>
                  {r.openai > 0 ? fmtUSD(r.openai) : "—"}
                </Td>
                <Td align="right" mono style={{ fontWeight: 600, color: "var(--ink)" }}>
                  {fmtUSD(r.total)}
                </Td>
                <Td style={{ width: 200 }}>
                  <RatioBar a={r.anthropic} b={r.openai} total={maxTotal} />
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
