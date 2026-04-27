import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { BudgetsManager } from "./BudgetsManager";

export default async function BudgetsPage() {
  const devs  = await repo.getDevelopers();
  const teams = Array.from(new Set(devs.map((d) => d.team).filter(Boolean) as string[]));

  return (
    <div>
      <PageHeader
        title="Budgets"
        scriptAccent="alerts"
        subtitle="Set monthly caps and daily-average thresholds. Breaches show as banners on Overview."
      />
      <BudgetsManager devs={devs} teams={teams} />
    </div>
  );
}
