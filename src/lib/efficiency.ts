/**
 * Token-efficiency metrics — how much $ each developer spends per output token.
 * High cost / output ratio usually means: massive prompts, no caching, expensive
 * model for the workload. Useful for surfacing optimization opportunities.
 */

import type { UsageDaily } from "./types";

export interface DevEfficiency {
  developerId:    string;
  cost:           number;
  inputTokens:    number;
  outputTokens:   number;
  /** $ per 1M output tokens (the standard pricing unit). */
  costPerMOutput: number;
  /** Ratio of input:output tokens — high = giant prompts, low output. */
  inOutRatio:     number;
}

export function developerEfficiency(rows: UsageDaily[], keyToDev: Map<string, string>): DevEfficiency[] {
  const agg = new Map<string, { cost: number; inputTokens: number; outputTokens: number }>();
  for (const u of rows) {
    const devId = keyToDev.get(u.api_key_id);
    if (!devId) continue;
    const e = agg.get(devId) ?? { cost: 0, inputTokens: 0, outputTokens: 0 };
    e.cost         += u.cost_usd;
    e.inputTokens  += u.input_tokens;
    e.outputTokens += u.output_tokens;
    agg.set(devId, e);
  }

  return [...agg.entries()].map(([developerId, e]) => ({
    developerId,
    cost:           e.cost,
    inputTokens:    e.inputTokens,
    outputTokens:   e.outputTokens,
    costPerMOutput: e.outputTokens > 0 ? (e.cost / e.outputTokens) * 1_000_000 : 0,
    inOutRatio:     e.outputTokens > 0 ? e.inputTokens / e.outputTokens : 0,
  }));
}
