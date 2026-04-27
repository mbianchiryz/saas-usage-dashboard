import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

// GET /api/shared?key=amex_csv
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key) return Response.json({ error: "missing key" }, { status: 400 });

  const { data, error } = await supabase
    .from("shared_data")
    .select("value, updated_at")
    .eq("key", key)
    .single();

  if (error || !data) return Response.json({ data: null });
  return Response.json({ data: data.value, updated_at: data.updated_at });
}

// POST /api/shared  body: { key, value }
export async function POST(req: NextRequest) {
  const { key, value } = await req.json();
  if (!key || !value) return Response.json({ error: "missing key or value" }, { status: 400 });

  const { error } = await supabase
    .from("shared_data")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
