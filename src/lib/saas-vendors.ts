/**
 * User-defined SaaS vendor catalog.
 *
 * Each vendor is a canonical name plus an optional list of regex/substring
 * patterns used to match Amex descriptions to this vendor. Patterns are
 * checked BEFORE the built-in classifier, so the user can override defaults
 * or define vendors the classifier doesn't know about.
 *
 * Storage: persisted under shared_data.key = "saas_vendors".
 */

import type { SaasCategory } from "./saas-classifier";

export interface SaasVendor {
  id:               string;
  name:             string;
  category:         SaasCategory;
  /** Optional case-insensitive regex/substring patterns to match the Amex description.
   *  When omitted, only the built-in classifier picks this vendor up. */
  patterns:         string[];
  /** Optional expected monthly spend, used to flag variance. */
  expectedMonthly?: number;
  notes?:           string;
  createdAt:        string;
}

export function newVendorId(): string {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
