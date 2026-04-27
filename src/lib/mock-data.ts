import type { Developer, ApiKey, UsageDaily, AmexCharge, Provider } from "./types";

// Deterministic PRNG so mock data is stable across reloads
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(42);

const CLAUDE_DEVS = [
  "Lucas Fernandez", "Maria Gomez", "Juan Perez", "Sofia Rodriguez",
  "Diego Martinez", "Camila Silva", "Matias Lopez", "Valentina Diaz",
  "Nicolas Torres", "Julieta Romero", "Santiago Ruiz", "Agustina Castro",
];
const OPENAI_DEVS = [
  "Lucas Fernandez", "Maria Gomez", "Diego Martinez",
  "Sofia Rodriguez", "Matias Lopez", "Nicolas Torres",
];

const CLAUDE_MODELS = [
  { name: "claude-opus-4-7", inCost: 15 / 1_000_000, outCost: 75 / 1_000_000, weight: 0.35 },
  { name: "claude-sonnet-4-6", inCost: 3 / 1_000_000, outCost: 15 / 1_000_000, weight: 0.5 },
  { name: "claude-haiku-4-5", inCost: 0.8 / 1_000_000, outCost: 4 / 1_000_000, weight: 0.15 },
];
const OPENAI_MODELS = [
  { name: "gpt-4o", inCost: 2.5 / 1_000_000, outCost: 10 / 1_000_000, weight: 0.5 },
  { name: "o1", inCost: 15 / 1_000_000, outCost: 60 / 1_000_000, weight: 0.25 },
  { name: "gpt-4o-mini", inCost: 0.15 / 1_000_000, outCost: 0.6 / 1_000_000, weight: 0.25 },
];

function pickWeighted<T extends { weight: number }>(items: T[], r: number): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let acc = 0;
  const target = r * total;
  for (const it of items) {
    acc += it.weight;
    if (target <= acc) return it;
  }
  return items[items.length - 1];
}

function slug(name: string) {
  return name.toLowerCase().replace(/\s+/g, ".");
}

export const developers: Developer[] = (() => {
  const all = new Set([...CLAUDE_DEVS, ...OPENAI_DEVS]);
  return Array.from(all).map((name, i) => ({
    id: `dev_${i + 1}`,
    name,
    email: `${slug(name)}@company.com`,
    team: i % 3 === 0 ? "Platform" : i % 3 === 1 ? "AI Products" : "Research",
  }));
})();

const devByName = new Map(developers.map((d) => [d.name, d]));

export const apiKeys: ApiKey[] = [
  ...CLAUDE_DEVS.map((name, i) => ({
    id: `key_anthropic_${i + 1}`,
    provider: "anthropic" as Provider,
    external_key_id: `sk-ant-api03-${Math.floor(rand() * 1e10).toString(36)}`,
    label: `${name.split(" ")[0]} — Claude`,
    developer_id: devByName.get(name)!.id,
  })),
  ...OPENAI_DEVS.map((name, i) => ({
    id: `key_openai_${i + 1}`,
    provider: "openai" as Provider,
    external_key_id: `sk-proj-${Math.floor(rand() * 1e10).toString(36)}`,
    label: `${name.split(" ")[0]} — OpenAI`,
    developer_id: devByName.get(name)!.id,
  })),
];

/** Mock data anchor — pinned to "today" so the dashboard always shows fresh data.
 *  Stripped to YYYY-MM-DD (no time) so all dates are deterministic per day. */
const TODAY = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00");

function dateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}

// Per-developer usage intensity — some devs use a LOT more than others
const DEV_INTENSITY = new Map(
  developers.map((d, i) => [d.id, 0.2 + (mulberry32(i + 100)() * 2.5)]),
);

export const usageDaily: UsageDaily[] = (() => {
  const rows: UsageDaily[] = [];
  const DAYS = 90;

  for (let offset = DAYS - 1; offset >= 0; offset--) {
    const d = new Date(TODAY);
    d.setDate(d.getDate() - offset);
    const dow = d.getDay();
    const weekendFactor = dow === 0 || dow === 6 ? 0.3 : 1;
    const dateS = dateStr(d);

    for (const key of apiKeys) {
      const intensity = DEV_INTENSITY.get(key.developer_id)!;
      const models = key.provider === "anthropic" ? CLAUDE_MODELS : OPENAI_MODELS;

      // 1-3 model rows per key per day
      const numModels = 1 + Math.floor(rand() * 3);
      const used = new Set<string>();
      for (let m = 0; m < numModels; m++) {
        const model = pickWeighted(models, rand());
        if (used.has(model.name)) continue;
        used.add(model.name);

        const baseIn = 50_000 + rand() * 500_000;
        const baseOut = 10_000 + rand() * 150_000;
        const input = Math.floor(baseIn * intensity * weekendFactor);
        const output = Math.floor(baseOut * intensity * weekendFactor);
        const cost = input * model.inCost + output * model.outCost;

        if (cost < 0.01) continue;

        rows.push({
          date: dateS,
          provider: key.provider,
          api_key_id: key.id,
          model: model.name,
          input_tokens: input,
          output_tokens: output,
          cost_usd: Number(cost.toFixed(4)),
        });
      }
    }
  }
  return rows;
})();

export const amexCharges: AmexCharge[] = (() => {
  const charges: AmexCharge[] = [];
  // Monthly charges for the last 3 months
  for (let monthsAgo = 3; monthsAgo >= 1; monthsAgo--) {
    const d = new Date(TODAY);
    d.setMonth(d.getMonth() - monthsAgo);
    d.setDate(1 + Math.floor(rand() * 5));

    // Anthropic charge
    const monthStart = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth(), 0);
    const monthCostAnthropic = usageDaily
      .filter((u) => u.provider === "anthropic" && u.date >= dateStr(monthStart) && u.date <= dateStr(monthEnd))
      .reduce((s, u) => s + u.cost_usd, 0);
    const monthCostOpenAI = usageDaily
      .filter((u) => u.provider === "openai" && u.date >= dateStr(monthStart) && u.date <= dateStr(monthEnd))
      .reduce((s, u) => s + u.cost_usd, 0);

    // Add small variance (taxes, rounding) to simulate real-world reconciliation deltas
    charges.push({
      id: `amex_${charges.length + 1}`,
      date: dateStr(d),
      merchant: "ANTHROPIC PBC",
      amount_usd: Number((monthCostAnthropic * (1 + (rand() - 0.5) * 0.03)).toFixed(2)),
      provider_matched: "anthropic",
      raw_description: "ANTHROPIC PBC SAN FRANCISCO CA",
    });
    d.setDate(d.getDate() + 2);
    charges.push({
      id: `amex_${charges.length + 1}`,
      date: dateStr(d),
      merchant: "OPENAI",
      amount_usd: Number((monthCostOpenAI * (1 + (rand() - 0.5) * 0.03)).toFixed(2)),
      provider_matched: "openai",
      raw_description: "OPENAI *SUBSCR SAN FRANCISCO",
    });
  }

  // A few unmatched charges
  charges.push({
    id: `amex_${charges.length + 1}`,
    date: dateStr(new Date(TODAY.getTime() - 10 * 86400_000)),
    merchant: "AWS",
    amount_usd: 1243.55,
    provider_matched: null,
    raw_description: "AMAZON WEB SERVICES AWS.AMAZON.CO",
  });

  return charges;
})();
