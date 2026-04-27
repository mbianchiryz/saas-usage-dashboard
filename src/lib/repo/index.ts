import type { Developer, ApiKey, UsageDaily, AmexCharge, Provider } from "../types";
import { developers, apiKeys, usageDaily, amexCharges } from "../mock-data";

export interface Repo {
  getDevelopers(): Promise<Developer[]>;
  getApiKeys(): Promise<ApiKey[]>;
  getUsage(filter?: { from?: string; to?: string; provider?: Provider }): Promise<UsageDaily[]>;
  getAmexCharges(): Promise<AmexCharge[]>;
}

class MockRepo implements Repo {
  async getDevelopers() { return developers; }
  async getApiKeys() { return apiKeys; }
  async getUsage(filter?: { from?: string; to?: string; provider?: Provider }) {
    return usageDaily.filter((u) => {
      if (filter?.from && u.date < filter.from) return false;
      if (filter?.to && u.date > filter.to) return false;
      if (filter?.provider && u.provider !== filter.provider) return false;
      return true;
    });
  }
  async getAmexCharges() { return amexCharges; }
}

// Later: swap this for SupabaseRepo based on env var
export const repo: Repo = new MockRepo();
