import Link from "next/link";
import { Suspense } from "react";
import { repo } from "@/lib/repo";
import { supabase } from "@/lib/supabase";
import { todayStr } from "@/lib/metrics";
import { evaluateBudgets, describeScope, type Budget } from "@/lib/budgets";
import { PageHeader } from "@/components/ui";
import { AlertTriangle } from "lucide-react";
import { AmexOverviewSection } from "./AmexOverviewSection";

export default async function OverviewPage() {
  /* ── Budgets (still server-evaluated against the usage repo) ── */
  const today = todayStr();
  const [usage, keys, devs, budgetsRow] = await Promise.all([
    repo.getUsage(),
    repo.getApiKeys(),
    repo.getDevelopers(),
    supabase.from("shared_data").select("value").eq("key", "budgets").single(),
  ]);
  const budgetList: Budget[] = Array.isArray(budgetsRow.data?.value?.list) ? budgetsRow.data.value.list : [];
  const evaluations = evaluateBudgets(budgetList, usage, keys, devs, today);
  const breaches    = evaluations.filter((e) => e.status !== "ok");

  return (
    <div>
      <PageHeader
        title="AI Overview"
        subtitle="Anthropic & OpenAI spend, derived from your Amex statement"
      />

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

      {/* Everything else — driven by Amex data, loaded client-side.
          Wrapped in Suspense because useSearchParams() bails out of
          static prerendering otherwise. */}
      <Suspense fallback={null}>
        <AmexOverviewSection />
      </Suspense>
    </div>
  );
}
