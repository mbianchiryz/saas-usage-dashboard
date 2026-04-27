/**
 * GET  /api/budgets        → returns Budget[]
 * POST /api/budgets        → body: { budgets: Budget[] }; replaces the full list
 *
 * Storage piggybacks on the existing `shared_data` table under key "budgets".
 * No PIN is required — budgets are configuration, not destructive.
 */

import { supabase } from "@/lib/supabase";
import type { Budget } from "@/lib/budgets";
import { NextRequest } from "next/server";

const KEY = "budgets";

export async function GET() {
  const { data, error } = await supabase
    .from("shared_data")
    .select("value")
    .eq("key", KEY)
    .single();
  if (error || !data) return Response.json({ budgets: [] });
  const list = Array.isArray(data.value?.list) ? (data.value.list as Budget[]) : [];
  return Response.json({ budgets: list });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const budgets = body?.budgets;
  if (!Array.isArray(budgets)) {
    return Response.json({ error: "budgets must be an array" }, { status: 400 });
  }

  const { error } = await supabase
    .from("shared_data")
    .upsert({ key: KEY, value: { list: budgets }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
