import { supabase } from "@/lib/supabase";
import { NextRequest } from "next/server";

const CLEAR_PIN = process.env.CLEAR_PIN ?? "1234";

/** True if the value object is a "clear" payload — empty / null / no meaningful keys. */
function isClearPayload(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value !== "object") return false;
  return Object.keys(value as object).length === 0;
}

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

// POST /api/shared  body: { key, value, pin? }
// PIN is REQUIRED only for clear operations (empty value).
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { key, value, pin } = body as { key?: string; value?: unknown; pin?: string };

  if (!key) return Response.json({ error: "missing key" }, { status: 400 });
  if (value === undefined) return Response.json({ error: "missing value" }, { status: 400 });

  // Server-side PIN check: clearing the shared CSV requires the correct PIN.
  if (isClearPayload(value)) {
    if (pin !== CLEAR_PIN) {
      return Response.json({ error: "invalid_pin" }, { status: 403 });
    }
  }

  const { error } = await supabase
    .from("shared_data")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
