#!/usr/bin/env node
/**
 * Imports vendors from "SaaS Analysis.csv" into the running dev server's catalog.
 * Run:  node scripts/import-vendors.mjs
 *
 * Idempotent: skips vendors whose name already exists (case-insensitive).
 */
import { readFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const CSV  = "SaaS Analysis.csv";

const TEAM_TO_CATEGORY = {
  "all":          "all",
  "dev team":     "dev",
  "ntrvsta":      "ntrvsta",
  "recruiting":   "recruiting",
  "social/video": "video",
  "accounting":   "accounting",
  "sales":        "sales",
  "hiptrain":     "hiptrain",
  "offsiteio":    "offsiteio",
  "it":           "it",
};

function newId() {
  return `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

const csv  = readFileSync(CSV, "utf8").trim().split(/\r?\n/);
const rows = csv.slice(1).map((line) => {
  const [name, team] = line.split(",").map((s) => s.trim());
  return { name, team };
});

console.log(`Parsed ${rows.length} rows from ${CSV}`);

const existing = await fetch(`${BASE}/api/saas-vendors`).then((r) => r.json());
const cur      = Array.isArray(existing.vendors) ? existing.vendors : [];
const haveName = new Set(cur.map((v) => v.name.toLowerCase()));

const additions = [];
const skipped   = [];
const unmapped  = [];

for (const { name, team } of rows) {
  if (!name) continue;
  if (haveName.has(name.toLowerCase())) { skipped.push(name); continue; }

  const cat = TEAM_TO_CATEGORY[team.toLowerCase()];
  if (!cat) { unmapped.push(`${name} → ${team}`); continue; }

  additions.push({
    id:        newId(),
    name,
    category:  cat,
    patterns:  [name],
    createdAt: new Date().toISOString(),
  });
}

console.log(`Adding ${additions.length}, skipping ${skipped.length} duplicates, ${unmapped.length} unmapped`);
if (skipped.length)  console.log("  Skipped:", skipped.join(", "));
if (unmapped.length) console.log("  Unmapped:", unmapped.join(", "));

const next = [...cur, ...additions];
const res  = await fetch(`${BASE}/api/saas-vendors`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ vendors: next }),
});

if (!res.ok) {
  console.error("Save failed:", res.status, await res.text());
  process.exit(1);
}
console.log(`Saved. Catalog now has ${next.length} vendors.`);
