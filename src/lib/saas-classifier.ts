/**
 * Classify Amex charge descriptions into known SaaS vendors.
 *
 * Catches recurring software subscriptions across the company (creative tools,
 * AI tooling beyond Anthropic/OpenAI, devops, cloud, communication, etc.).
 * Falls back to a cleaned form of the original description when no pattern matches.
 */

export interface SaasMatch {
  /** Canonical vendor name. */
  name:     string;
  /** Coarse category for grouping / coloring. */
  category: SaasCategory;
}

/**
 * Categories are framed by *which team owns the spend*, not by what the software
 * does. Finance/owners think in terms of cost centers, not product taxonomies.
 */
export type SaasCategory =
  | "sales"
  | "recruiting"
  | "accounting"
  | "it"
  | "video"
  | "dev"
  | "other";

interface Rule {
  name:     string;
  category: SaasCategory;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  // ── Recruiting ──
  { name: "Ntrvsta",      category: "recruiting", patterns: [/ntrvsta/i, /intervista/i] },
  { name: "LinkedIn",     category: "recruiting", patterns: [/linkedin/i] },
  { name: "Greenhouse",   category: "recruiting", patterns: [/greenhouse/i] },
  { name: "Lever",        category: "recruiting", patterns: [/\blever\b/i] },

  // ── Sales ──
  { name: "Hiptrain",     category: "sales",      patterns: [/hip\s*train/i, /hiptrain/i] },
  { name: "HubSpot",      category: "sales",      patterns: [/hubspot/i] },
  { name: "Salesforce",   category: "sales",      patterns: [/salesforce/i] },
  { name: "Apollo",       category: "sales",      patterns: [/apollo\.io/i] },

  // ── Accounting & billing ──
  { name: "Stripe",       category: "accounting", patterns: [/stripe/i] },
  { name: "QuickBooks",   category: "accounting", patterns: [/quickbooks/i, /quick\s*books/i] },
  { name: "Xero",         category: "accounting", patterns: [/\bxero\b/i] },
  { name: "Brex",         category: "accounting", patterns: [/\bbrex\b/i] },
  { name: "Ramp",         category: "accounting", patterns: [/\bramp\.com\b/i] },

  // ── IT (cloud, infra, productivity, security, comms) ──
  { name: "AWS",              category: "it", patterns: [/amazon\s*web\s*services/i, /\baws\b/i] },
  { name: "Google Cloud",     category: "it", patterns: [/google\s*cloud/i, /\bgcp\b/i, /google\s*\*?cloud/i] },
  { name: "Azure",            category: "it", patterns: [/microsoft\s*azure/i, /azure\s*cloud/i] },
  { name: "Vercel",           category: "it", patterns: [/vercel/i] },
  { name: "Cloudflare",       category: "it", patterns: [/cloudflare/i] },
  { name: "Netlify",          category: "it", patterns: [/netlify/i] },
  { name: "Heroku",           category: "it", patterns: [/heroku/i] },
  { name: "DigitalOcean",     category: "it", patterns: [/digital\s*ocean/i, /digitalocean/i] },
  { name: "Render",           category: "it", patterns: [/render\.com/i] },
  { name: "Supabase",         category: "it", patterns: [/supabase/i] },
  { name: "Fly.io",           category: "it", patterns: [/\bfly\.io\b/i] },
  { name: "Slack",            category: "it", patterns: [/\bslack\b/i] },
  { name: "Zoom",             category: "it", patterns: [/\bzoom\b/i, /zoom\.us/i] },
  { name: "Notion",           category: "it", patterns: [/notion\s*labs/i, /\bnotion\.so\b/i, /\bnotion\b/i] },
  { name: "Google Workspace", category: "it", patterns: [/google\s*\*?gsuite/i, /google\s*workspace/i, /google\s*g\s*suite/i] },
  { name: "Microsoft 365",    category: "it", patterns: [/microsoft\s*365/i, /office\s*365/i, /msft\s*\*?\s*office/i] },
  { name: "Dropbox",          category: "it", patterns: [/dropbox/i] },
  { name: "1Password",        category: "it", patterns: [/1\s*password/i, /1password/i] },
  { name: "LastPass",         category: "it", patterns: [/lastpass/i] },

  // ── Video / creative ──
  { name: "Adobe",        category: "video", patterns: [/adobe/i, /\bcreative\s*cloud\b/i] },
  { name: "Figma",        category: "video", patterns: [/figma/i] },
  { name: "Canva",        category: "video", patterns: [/canva/i] },
  { name: "Framer",       category: "video", patterns: [/framer/i] },
  { name: "ElevenLabs",   category: "video", patterns: [/eleven\s*labs?/i, /elevenlabs/i] },
  { name: "HeyGen",       category: "video", patterns: [/hey\s*gen/i, /heygen/i] },
  { name: "Midjourney",   category: "video", patterns: [/midjourney/i] },
  { name: "Runway",       category: "video", patterns: [/runway\s*ml/i, /runwayml/i] },

  // ── Dev team ──
  { name: "GitHub",         category: "dev", patterns: [/github/i] },
  { name: "GitLab",         category: "dev", patterns: [/gitlab/i] },
  { name: "Linear",         category: "dev", patterns: [/linear\.app/i, /linear\s*pbc/i] },
  { name: "Sentry",         category: "dev", patterns: [/sentry/i] },
  { name: "Datadog",        category: "dev", patterns: [/datadog/i] },
  { name: "PagerDuty",      category: "dev", patterns: [/pagerduty/i] },
  { name: "JetBrains",      category: "dev", patterns: [/jetbrains/i] },
  { name: "Postman",        category: "dev", patterns: [/postman/i] },
  { name: "Cursor",         category: "dev", patterns: [/cursor\s*ai/i, /\bcursor\.com\b/i, /cursor\s*sh/i] },
  { name: "GitHub Copilot", category: "dev", patterns: [/copilot/i] },
  { name: "Hugging Face",   category: "dev", patterns: [/hugging\s*face/i] },
  { name: "Replicate",      category: "dev", patterns: [/replicate\.com/i, /replicate\s*inc/i] },
  { name: "Perplexity",     category: "dev", patterns: [/perplexity/i] },

  // ── Other (team-building, misc) ──
  { name: "Offsiteio",    category: "other", patterns: [/offsite\.io/i, /offsiteio/i, /offsite\s*io/i] },
  { name: "Spotify",      category: "other", patterns: [/spotify/i] },
  { name: "Netflix",      category: "other", patterns: [/netflix/i] },
  { name: "YouTube",      category: "other", patterns: [/youtube\s*premium/i, /\byoutube\b/i] },
  { name: "Apple",        category: "other", patterns: [/apple\.com\/bill/i, /apple\s*services/i] },
];

/** Strip Amex noise (city/state, store numbers, asterisks) so unmatched rows still group sensibly. */
function cleanFallback(desc: string): string {
  return desc
    .replace(/\b\d{3,}\b/g, "")              // remove long digit runs (store numbers)
    .replace(/\s+\*\s+/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+(SAN FRANCISCO|NEW YORK|SEATTLE|DUBLIN|PALO ALTO|LOS ANGELES|MOUNTAIN VIEW|REDMOND|AUSTIN|TX|CA|NY|WA|UK|IRL?|US)\b.*$/i, "")
    .trim();
}

export interface UserVendorRule {
  name:     string;
  category: SaasCategory;
  patterns: string[]; // substrings or regex sources, matched case-insensitive
}

function userPatternsToRegex(p: string): RegExp {
  // Treat as regex if it contains regex metacharacters; otherwise as a literal substring
  const isRegex = /[.*+?^${}()|[\]\\]/.test(p);
  try {
    return new RegExp(isRegex ? p : p.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&"), "i");
  } catch {
    return new RegExp(p.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&"), "i");
  }
}

export function classifySaas(description: string, userVendors: UserVendorRule[] = []): SaasMatch {
  /* User-defined patterns take precedence */
  for (const v of userVendors) {
    for (const p of v.patterns) {
      if (!p.trim()) continue;
      if (userPatternsToRegex(p).test(description)) {
        return { name: v.name, category: v.category };
      }
    }
  }
  /* Built-in rules */
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(description))) {
      return { name: rule.name, category: rule.category };
    }
  }
  return { name: cleanFallback(description) || "Other", category: "other" };
}

export const CATEGORY_LABEL: Record<SaasCategory, string> = {
  sales:      "Sales",
  recruiting: "Recruiting",
  accounting: "Accounting",
  it:         "IT",
  video:      "Social/Video",
  dev:        "Dev team",
  other:      "Other",
};
