/**
 * Budget rules — define spending limits and evaluate them against current usage.
 *
 * A Budget can target the whole org, a specific developer, a team, or a provider.
 * Two types are supported:
 *   - "monthly":   absolute cap for the calendar month (with projection for in-progress months)
 *   - "daily-avg": cap on the rolling 7-day average daily spend
 *
 * Storage: persisted as a JSON array under shared_data.key = "budgets".
 */

import type { ApiKey, Developer, UsageDaily } from "./types";

export type BudgetScope = "global" | "developer" | "team" | "provider";
export type BudgetType  = "monthly" | "daily-avg";
export type BudgetStatus = "ok" | "warn" | "exceeded";

export interface Budget {
  id:        string;
  name:      string;
  scope:     BudgetScope;
  /** Required for "developer" (dev id), "team" (team name), "provider" ("anthropic" | "openai"). Empty for "global". */
  scopeId?:  string;
  type:      BudgetType;
  /** USD cap. */
  amount:    number;
  /** Percentage of `amount` that triggers a warning (e.g. 80 = 80%). 100+ disables the warn level. */
  warnAt:    number;
  createdAt: string;
}

export interface BudgetEvaluation {
  budget:    Budget;
  /** Current observed value (MTD spend, projection, or daily avg depending on type). */
  current:   number;
  /** Projected month-end (only set for monthly type). */
  projected?: number;
  /** Pct of budget used (0-150+). */
  pctUsed:   number;
  status:    BudgetStatus;
  /** Friendly subject line for the banner / notification. */
  message:   string;
}

const ymOf = (d: string) => d.slice(0, 7);

function devsInScope(b: Budget, devs: Developer[]): Set<string> {
  if (b.scope === "developer" && b.scopeId) return new Set([b.scopeId]);
  if (b.scope === "team" && b.scopeId) return new Set(devs.filter((d) => d.team === b.scopeId).map((d) => d.id));
  return new Set(devs.map((d) => d.id));
}

function rowsInScope(
  b: Budget,
  rows: UsageDaily[],
  keyToDev: Map<string, string>,
  scopedDevs: Set<string>,
): UsageDaily[] {
  return rows.filter((r) => {
    if (b.scope === "provider" && b.scopeId) {
      return r.provider === b.scopeId;
    }
    const devId = keyToDev.get(r.api_key_id);
    if (!devId) return false;
    return scopedDevs.has(devId);
  });
}

function projectMonthEnd(mtd: number, todayISO: string): number {
  const [y, m, d] = todayISO.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return mtd / d * days;
}

export function evaluateBudgets(
  budgets: Budget[],
  rows: UsageDaily[],
  keys: ApiKey[],
  devs: Developer[],
  todayISO: string,
): BudgetEvaluation[] {
  const keyToDev = new Map(keys.map((k) => [k.id, k.developer_id]));
  const ym       = todayISO.slice(0, 7);

  return budgets.map((b) => {
    const scopedDevs = devsInScope(b, devs);
    const allScoped  = rowsInScope(b, rows, keyToDev, scopedDevs);

    let current  = 0;
    let projected: number | undefined;
    let label    = "";

    if (b.type === "monthly") {
      const mtdRows = allScoped.filter((r) => ymOf(r.date) === ym);
      const mtd     = mtdRows.reduce((s, r) => s + r.cost_usd, 0);
      current   = mtd;
      projected = projectMonthEnd(mtd, todayISO);
      label     = `Month-to-date $${Math.round(mtd).toLocaleString()} of $${Math.round(b.amount).toLocaleString()}`;
    } else {
      // daily-avg over the last 7 days
      const cutoff = new Date(todayISO + "T00:00:00");
      cutoff.setDate(cutoff.getDate() - 6);
      const cutoffISO = cutoff.toISOString().slice(0, 10);
      const recent = allScoped.filter((r) => r.date >= cutoffISO && r.date <= todayISO);
      const total  = recent.reduce((s, r) => s + r.cost_usd, 0);
      const days   = new Set(recent.map((r) => r.date)).size || 1;
      current  = total / days;
      label    = `7-day avg $${current.toFixed(2)}/day vs cap $${b.amount.toFixed(2)}/day`;
    }

    const compareTo = b.type === "monthly" ? (projected ?? current) : current;
    const pctUsed   = b.amount > 0 ? (compareTo / b.amount) * 100 : 0;

    let status: BudgetStatus = "ok";
    if (pctUsed >= 100) status = "exceeded";
    else if (pctUsed >= b.warnAt) status = "warn";

    return { budget: b, current, projected, pctUsed, status, message: label };
  });
}

export function newBudgetId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function describeScope(b: Budget, devs: Developer[]): string {
  if (b.scope === "global") return "All spend";
  if (b.scope === "provider") return b.scopeId === "anthropic" ? "Anthropic" : b.scopeId === "openai" ? "OpenAI" : (b.scopeId ?? "—");
  if (b.scope === "team") return `Team: ${b.scopeId ?? "—"}`;
  if (b.scope === "developer") {
    const d = devs.find((x) => x.id === b.scopeId);
    return d ? `Dev: ${d.name}` : `Dev: ${b.scopeId}`;
  }
  return "—";
}
