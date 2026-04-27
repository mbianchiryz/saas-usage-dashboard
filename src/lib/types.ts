export type Provider = "anthropic" | "openai" | "amex";

export interface Developer {
  id: string;
  name: string;
  email: string;
  team?: string;
}

export interface ApiKey {
  id: string;
  provider: Provider;
  external_key_id: string;
  label: string;
  developer_id: string;
}

export interface UsageDaily {
  date: string; // YYYY-MM-DD
  provider: Provider;
  api_key_id: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

export interface AmexCharge {
  id: string;
  date: string;
  merchant: string;
  amount_usd: number;
  provider_matched: Provider | null;
  raw_description: string;
}

export interface Reconciliation {
  month: string; // YYYY-MM
  provider: Provider;
  api_reported_cost: number;
  amex_billed_cost: number;
  delta: number;
  delta_pct: number;
}
