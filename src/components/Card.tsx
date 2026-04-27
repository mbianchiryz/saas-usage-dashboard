import { ReactNode } from "react";
import clsx from "clsx";

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={clsx("rounded-lg border border-neutral-800 bg-neutral-900/50 p-5", className)}>
      {children}
    </div>
  );
}

export function StatCard({
  label, value, sub, accent,
}: {
  label: string; value: string; sub?: ReactNode; accent?: "anthropic" | "openai" | "amex" | "neutral";
}) {
  const bar = {
    anthropic: "bg-brand-anthropic",
    openai: "bg-brand-openai",
    amex: "bg-brand-amex",
    neutral: "bg-neutral-600",
  }[accent ?? "neutral"];
  return (
    <Card className="relative overflow-hidden">
      <div className={clsx("absolute left-0 top-0 h-full w-1", bar)} />
      <div className="pl-2">
        <div className="text-xs uppercase tracking-wide text-neutral-400">{label}</div>
        <div className="mt-1 text-3xl font-semibold">{value}</div>
        {sub && <div className="mt-2 text-sm text-neutral-400">{sub}</div>}
      </div>
    </Card>
  );
}
