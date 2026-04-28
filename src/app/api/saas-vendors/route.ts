/**
 * GET  /api/saas-vendors        → returns SaasVendor[]
 * POST /api/saas-vendors        → body: { vendors: SaasVendor[] }; replaces full list
 */

import { supabase } from "@/lib/supabase";
import type { SaasVendor } from "@/lib/saas-vendors";
import { NextRequest } from "next/server";

const KEY = "saas_vendors";

export async function GET() {
  const { data, error } = await supabase
    .from("shared_data")
    .select("value")
    .eq("key", KEY)
    .single();
  if (error || !data) return Response.json({ vendors: [] });
  const list = Array.isArray(data.value?.list) ? (data.value.list as SaasVendor[]) : [];
  return Response.json({ vendors: list });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const vendors = body?.vendors;
  if (!Array.isArray(vendors)) {
    return Response.json({ error: "vendors must be an array" }, { status: 400 });
  }
  const { error } = await supabase
    .from("shared_data")
    .upsert({ key: KEY, value: { list: vendors }, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
