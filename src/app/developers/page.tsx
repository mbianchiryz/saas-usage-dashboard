import { repo } from "@/lib/repo";
import { parseRange, filterByRange } from "@/lib/dateRange";
import { Panel, PageHeader, Pill } from "@/components/ui";
import { DevelopersTable, type DevRow } from "./DevelopersTable";

export default async function DevelopersPage({
  searchParams,
}: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp    = await searchParams;
  const range = parseRange(sp);

  const [usage, keys, devs] = await Promise.all([
    repo.getUsage(),
    repo.getApiKeys(),
    repo.getDevelopers(),
  ]);

  const periodRows = filterByRange(usage, range);
  const keyById    = new Map(keys.map((k) => [k.id, k]));
  const devById    = new Map(devs.map((d) => [d.id, d]));

  const byDev = new Map<string, DevRow>();
  for (const u of periodRows) {
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
        subtitle={`${rows.length} active developers · ${range.label.toLowerCase()}`}
        right={
          <>
            <Pill tone="neutral">${Math.round(grandTotal).toLocaleString()} total</Pill>
          </>
        }
      />

      <Panel padding={0} style={{ overflow: "hidden" }}>
        <DevelopersTable rows={rows} maxTotal={maxTotal} />
      </Panel>
    </div>
  );
}
