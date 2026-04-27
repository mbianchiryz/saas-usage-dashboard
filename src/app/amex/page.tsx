import { repo } from "@/lib/repo";
import { Card, StatCard } from "@/components/Card";
import { fmtUSD, fmtPct } from "@/lib/format";
import { AmexClientSection } from "./AmexClientSection";
import clsx from "clsx";

export default async function AmexPage() {
  const [charges, usage] = await Promise.all([
    repo.getAmexCharges(),
    repo.getUsage(),
  ]);

  // Build per-month API-reported costs
  const apiByMonthProvider = new Map<string, number>();
  for (const u of usage) {
    if (u.provider === "amex") continue;
    const key = `${u.date.slice(0, 7)}|${u.provider}`;
    apiByMonthProvider.set(key, (apiByMonthProvider.get(key) ?? 0) + u.cost_usd);
  }

  type Recon = {
    month: string; provider: string; api: number; amex: number; delta: number; deltaPct: number; chargeDate: string;
  };
  const recon: Recon[] = [];
  for (const c of charges) {
    if (!c.provider_matched) continue;
    const chargeMonth = c.date.slice(0, 7);
    // Amex charges the *prior* month's usage, so look back one month
    const [y, m] = chargeMonth.split("-").map(Number);
    const prevM = m === 1 ? 12 : m - 1;
    const prevY = m === 1 ? y - 1 : y;
    const usageMonth = `${prevY}-${String(prevM).padStart(2, "0")}`;
    const api = apiByMonthProvider.get(`${usageMonth}|${c.provider_matched}`) ?? 0;
    const delta = c.amount_usd - api;
    recon.push({
      month: usageMonth,
      provider: c.provider_matched,
      api,
      amex: c.amount_usd,
      delta,
      deltaPct: api > 0 ? delta / api : 0,
      chargeDate: c.date,
    });
  }
  recon.sort((a, b) => b.month.localeCompare(a.month));

  const totalApi = recon.reduce((s, r) => s + r.api, 0);
  const totalAmex = recon.reduce((s, r) => s + r.amex, 0);
  const totalDelta = totalAmex - totalApi;

  return (
    <div className="p-8 space-y-10">
      {/* CSV Upload Section */}
      <div>
        <div className="mb-4">
          <h1 className="text-2xl font-semibold">Amex Reconciliation</h1>
          <p className="text-sm text-neutral-400">Upload your Amex CSV to analyze Anthropic &amp; OpenAI charges</p>
        </div>
        <AmexClientSection />
      </div>

      {/* Mock baseline section */}
      <div className="space-y-6">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h2 className="text-lg font-medium">Mock baseline</h2>
            <span className="rounded bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">Simulated data · replace with real API</span>
          </div>
          <p className="text-sm text-neutral-500">Compare provider-reported cost vs Amex-billed amount (mock)</p>
        </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="API Reported (last 3mo)" value={fmtUSD(totalApi)} accent="neutral" />
        <StatCard label="Amex Billed (last 3mo)" value={fmtUSD(totalAmex)} accent="amex" />
        <StatCard
          label="Delta"
          value={fmtUSD(totalDelta)}
          sub={<span className={totalDelta >= 0 ? "text-yellow-400" : "text-green-400"}>
            {totalApi > 0 ? fmtPct(totalDelta / totalApi) : "—"} variance
          </span>}
          accent="neutral"
        />
      </div>

      <Card className="mt-6">
        <h2 className="mb-4 text-base font-medium">Monthly reconciliation</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-800 text-left text-xs uppercase tracking-wide text-neutral-400">
              <th className="py-3 pr-4">Usage Month</th>
              <th className="py-3 pr-4">Provider</th>
              <th className="py-3 pr-4">Amex Charge Date</th>
              <th className="py-3 pr-4 text-right">API Reported</th>
              <th className="py-3 pr-4 text-right">Amex Billed</th>
              <th className="py-3 pr-4 text-right">Delta</th>
              <th className="py-3 text-right">Variance</th>
            </tr>
          </thead>
          <tbody>
            {recon.map((r, i) => {
              const flag = Math.abs(r.deltaPct) > 0.02;
              return (
                <tr key={i} className="border-b border-neutral-900 last:border-0">
                  <td className="py-3 pr-4 font-mono text-xs">{r.month}</td>
                  <td className="py-3 pr-4 capitalize">{r.provider}</td>
                  <td className="py-3 pr-4 text-neutral-400 font-mono text-xs">{r.chargeDate}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{fmtUSD(r.api)}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{fmtUSD(r.amex)}</td>
                  <td className={clsx("py-3 pr-4 text-right tabular-nums", r.delta >= 0 ? "text-yellow-400" : "text-green-400")}>
                    {fmtUSD(r.delta)}
                  </td>
                  <td className={clsx("py-3 text-right tabular-nums", flag ? "text-red-400" : "text-neutral-400")}>
                    {fmtPct(r.deltaPct)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      </div>{/* end mock baseline */}
    </div>
  );
}
