import { repo } from "@/lib/repo";
import { Card } from "@/components/Card";
import { fmtUSD } from "@/lib/format";
import { mtdRange } from "@/lib/metrics";
import clsx from "clsx";

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

  type Row = { devId: string; name: string; team: string; anthropic: number; openai: number; total: number };
  const byDev = new Map<string, Row>();

  for (const u of mtdRows) {
    const key = keyById.get(u.api_key_id);
    if (!key) continue;
    const dev = devById.get(key.developer_id);
    if (!dev) continue;
    const row = byDev.get(dev.id) ?? {
      devId: dev.id, name: dev.name, team: dev.team ?? "", anthropic: 0, openai: 0, total: 0,
    };
    if (u.provider === "anthropic") row.anthropic += u.cost_usd;
    if (u.provider === "openai") row.openai += u.cost_usd;
    row.total += u.cost_usd;
    byDev.set(dev.id, row);
  }

  const rows = Array.from(byDev.values()).sort((a, b) => b.total - a.total);
  const maxTotal = Math.max(...rows.map((r) => r.total), 1);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">By Developer</h1>
        <p className="text-sm text-neutral-400">MTD spend per developer · {rows.length} active</p>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="py-3 pr-4">Developer</th>
              <th className="py-3 pr-4">Team</th>
              <th className="py-3 pr-4 text-right">Anthropic</th>
              <th className="py-3 pr-4 text-right">OpenAI</th>
              <th className="py-3 pr-4 text-right">Total</th>
              <th className="py-3">Share</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.devId} className="border-b border-neutral-900 last:border-0">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-500 w-5">{i + 1}</span>
                    <span>{r.name}</span>
                  </div>
                </td>
                <td className="py-3 pr-4 text-neutral-400">{r.team}</td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {r.anthropic > 0 ? fmtUSD(r.anthropic) : <span className="text-neutral-600">—</span>}
                </td>
                <td className="py-3 pr-4 text-right tabular-nums">
                  {r.openai > 0 ? fmtUSD(r.openai) : <span className="text-neutral-600">—</span>}
                </td>
                <td className="py-3 pr-4 text-right font-medium tabular-nums">{fmtUSD(r.total)}</td>
                <td className="py-3 w-48">
                  <div className="flex gap-0.5 h-2 rounded overflow-hidden bg-neutral-900">
                    <div
                      className="bg-brand-anthropic"
                      style={{ width: `${(r.anthropic / maxTotal) * 100}%` }}
                    />
                    <div
                      className="bg-brand-openai"
                      style={{ width: `${(r.openai / maxTotal) * 100}%` }}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
