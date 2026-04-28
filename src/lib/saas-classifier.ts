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

export type SaasCategory =
  | "ai"
  | "cloud"
  | "devtools"
  | "design"
  | "productivity"
  | "media"
  | "comms"
  | "billing"
  | "other";

interface Rule {
  name:     string;
  category: SaasCategory;
  patterns: RegExp[];
}

const RULES: Rule[] = [
  // ── AI / ML (besides Anthropic/OpenAI which have their own tab) ──
  { name: "ElevenLabs",   category: "ai",       patterns: [/eleven\s*labs?/i, /elevenlabs/i] },
  { name: "HeyGen",       category: "ai",       patterns: [/hey\s*gen/i, /heygen/i] },
  { name: "Midjourney",   category: "ai",       patterns: [/midjourney/i] },
  { name: "Runway",       category: "ai",       patterns: [/runway\s*ml/i, /runwayml/i] },
  { name: "Perplexity",   category: "ai",       patterns: [/perplexity/i] },
  { name: "Hugging Face", category: "ai",       patterns: [/hugging\s*face/i] },
  { name: "Replicate",    category: "ai",       patterns: [/replicate\.com/i, /replicate\s*inc/i] },
  { name: "Cursor",       category: "ai",       patterns: [/cursor\s*ai/i, /\bcursor\.com\b/i, /cursor\s*sh/i] },
  { name: "GitHub Copilot", category: "ai",     patterns: [/copilot/i] },

  // ── Cloud & infra ──
  { name: "AWS",          category: "cloud",    patterns: [/amazon\s*web\s*services/i, /\baws\b/i] },
  { name: "Google Cloud", category: "cloud",    patterns: [/google\s*cloud/i, /\bgcp\b/i, /google\s*\*?cloud/i] },
  { name: "Azure",        category: "cloud",    patterns: [/microsoft\s*azure/i, /azure\s*cloud/i] },
  { name: "Vercel",       category: "cloud",    patterns: [/vercel/i] },
  { name: "Cloudflare",   category: "cloud",    patterns: [/cloudflare/i] },
  { name: "Netlify",      category: "cloud",    patterns: [/netlify/i] },
  { name: "Heroku",       category: "cloud",    patterns: [/heroku/i] },
  { name: "DigitalOcean", category: "cloud",    patterns: [/digital\s*ocean/i, /digitalocean/i] },
  { name: "Render",       category: "cloud",    patterns: [/render\.com/i] },
  { name: "Supabase",     category: "cloud",    patterns: [/supabase/i] },
  { name: "Fly.io",       category: "cloud",    patterns: [/\bfly\.io\b/i] },

  // ── Dev tools ──
  { name: "GitHub",       category: "devtools", patterns: [/github/i] },
  { name: "GitLab",       category: "devtools", patterns: [/gitlab/i] },
  { name: "Linear",       category: "devtools", patterns: [/linear\.app/i, /linear\s*pbc/i] },
  { name: "Sentry",       category: "devtools", patterns: [/sentry/i] },
  { name: "Datadog",      category: "devtools", patterns: [/datadog/i] },
  { name: "PagerDuty",    category: "devtools", patterns: [/pagerduty/i] },
  { name: "JetBrains",    category: "devtools", patterns: [/jetbrains/i] },
  { name: "Postman",      category: "devtools", patterns: [/postman/i] },

  // ── Design ──
  { name: "Adobe",        category: "design",   patterns: [/adobe/i, /\bcreative\s*cloud\b/i] },
  { name: "Figma",        category: "design",   patterns: [/figma/i] },
  { name: "Canva",        category: "design",   patterns: [/canva/i] },
  { name: "Framer",       category: "design",   patterns: [/framer/i] },

  // ── Productivity / collab ──
  { name: "Notion",       category: "productivity", patterns: [/notion\s*labs/i, /\bnotion\.so\b/i, /\bnotion\b/i] },
  { name: "Slack",        category: "comms",        patterns: [/\bslack\b/i] },
  { name: "Zoom",         category: "comms",        patterns: [/\bzoom\b/i, /zoom\.us/i] },
  { name: "Google Workspace", category: "productivity", patterns: [/google\s*\*?gsuite/i, /google\s*workspace/i, /google\s*g\s*suite/i] },
  { name: "Microsoft 365", category: "productivity",   patterns: [/microsoft\s*365/i, /office\s*365/i, /msft\s*\*?\s*office/i] },
  { name: "Dropbox",      category: "productivity", patterns: [/dropbox/i] },
  { name: "1Password",    category: "productivity", patterns: [/1\s*password/i, /1password/i] },
  { name: "LastPass",     category: "productivity", patterns: [/lastpass/i] },

  // ── Media / streaming ──
  { name: "Spotify",      category: "media",    patterns: [/spotify/i] },
  { name: "Netflix",      category: "media",    patterns: [/netflix/i] },
  { name: "YouTube",      category: "media",    patterns: [/youtube\s*premium/i, /\byoutube\b/i] },
  { name: "Apple",        category: "media",    patterns: [/apple\.com\/bill/i, /apple\s*services/i] },

  // ── Billing / payments ──
  { name: "Stripe",       category: "billing",  patterns: [/stripe/i] },
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
  ai:           "AI",
  cloud:        "Cloud & infra",
  devtools:     "Dev tools",
  design:       "Design",
  productivity: "Productivity",
  media:        "Media",
  comms:        "Communication",
  billing:      "Billing",
  other:        "Other",
};
