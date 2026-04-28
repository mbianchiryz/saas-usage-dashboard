import { repo } from "@/lib/repo";
import { PageHeader } from "@/components/ui";
import { BudgetsManager } from "./BudgetsManager";
import { SaasVendorsManager } from "./SaasVendorsManager";

export default async function BudgetsPage() {
  const devs  = await repo.getDevelopers();
  const teams = Array.from(new Set(devs.map((d) => d.team).filter(Boolean) as string[]));

  return (
    <div>
      <PageHeader
        title="Budgets"
        scriptAccent="alerts"
        subtitle="Spending caps and the SaaS catalog that drives the SaaS tab."
      />
      <BudgetsManager devs={devs} teams={teams} />

      <div style={{ marginTop: 32 }}>
        <SaasVendorsManager />
      </div>
    </div>
  );
}
