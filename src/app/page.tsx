import { repo } from "@/lib/repo";
import { StatCard, Card } from "@/components/Card";
import { SpendOverTimeChart } from "@/components/charts/SpendOverTimeChart";
import { fmtUSD, fmtPct } from "@/lib/format";
import {
  mtdRange, prevMonthRange, sumCost, projectMonthEnd, dailySeriesByProvider,
} from "@/lib/metrics";

export default async function OverviewPage() {
  const usage = await repo.getUsage();
  const mtd = mtdRange();
  const prev = prevMonthRange();

  const mtdRows = usage.filter((r) => r.date >= mtd.from && r.date <= mtd.to);
  const prevRows = usage.filter((r) => r.date >= prev.from && r.date <= prev.to);

  const mtdTotal = sumCost(mtdRows);
  const mtdAnt = sumCost(mtdRows, "anthropic");
  const mtdOai = sumCost(mtdRows, "openai");
  const prevTotal = sumCost(prevRows);

  const projected = projectMonthEnd(mtdTotal);
  const momChange = prevTotal > 0 ? (projected - prevTotal) / prevTotal : 0;

  const last30 = usage.filter((r) => {
    const cutoff = new Date(mtd.to);
    cutoff.setDate(cutoff.getDate() - 29);
    return r.date >= cutoff.toISOString().slice(0, 10);
  });
  const series = dailySeriesByProvider(last30);

  const dayOfMonth = Number(mtd.to.slice(8));
  const burnRate = mtdTotal / dayOfMonth;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Overview</h1>
          <p className="text-sm text-neutral-400">Month-to-date spend across Anthropic & OpenAI</p>
        </div>
        <div className="text-sm text-neutral-500">As of {mtd.to}</div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="MTD Total"
          value={fmtUSD(mtdTotal)}
          sub={<span>vs {fmtUSD(prevTotal)} last month</span>}
          accent="neutral"
        />
        <StatCard
          label="Anthropic MTD"
          value={fmtUSD(mtdAnt)}
          sub={<span>{((mtdAnt / mtdTotal) * 100).toFixed(0)}% of total</span>}
          accent="anthropic"
        />
        <StatCard
          label="OpenAI MTD"
          value={fmtUSD(mtdOai)}
          sub={<span>{((mtdOai / mtdTotal) * 100).toFixed(0)}% of total</span>}
          accent="openai"
        />
        <StatCard
          label="Projected Month-End"
          value={fmtUSD(projected)}
          sub={
            <span className={momChange >= 0 ? "text-red-400" : "text-green-400"}>
              {fmtPct(momChange)} vs last month
            </span>
          }
          accent="neutral"
        />
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex items-baseline justify-between">
            <h2 className="text-base font-medium">Daily spend — last 30 days</h2>
            <div className="text-sm text-neutral-400">
              Burn rate: <span className="text-white">{fmtUSD(burnRate)}/day</span>
            </div>
          </div>
          <SpendOverTimeChart data={series} />
        </Card>
      </div>
    </div>
  );
}
