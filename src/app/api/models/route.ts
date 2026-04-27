import { repo } from "@/lib/repo";
import { mtdRange } from "@/lib/metrics";

export async function GET() {
  const usage = await repo.getUsage();
  const { from, to } = mtdRange();
  const rows = usage.filter((r) => r.date >= from && r.date <= to);

  type Agg = { model: string; provider: "anthropic" | "openai"; cost: number; input_tokens: number; output_tokens: number };
  const map = new Map<string, Agg>();
  for (const r of rows) {
    if (r.provider === "amex") continue;
    const e = map.get(r.model) ?? { model: r.model, provider: r.provider, cost: 0, input_tokens: 0, output_tokens: 0 };
    e.cost += r.cost_usd;
    e.input_tokens += r.input_tokens;
    e.output_tokens += r.output_tokens;
    map.set(r.model, e);
  }
  const out = Array.from(map.values()).sort((a, b) => b.cost - a.cost);
  return Response.json(out);
}
