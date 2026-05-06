import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

// SHA-256 of the dashboard password — change by running:
// echo -n 'yourpassword' | shasum -a 256
const PASSWORD_HASH = "31fa12c5ff761795841b1c72f1fa53e8cb07172638c2e5043ab4a897bbb1f3eb";
const AUTH_SECRET   = "8e070762468605bf20d3a821e0c67771173cf140cabf14a170dc30f165594da7";

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));

  if (!password || sha256(password) !== PASSWORD_HASH) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("dash_auth", AUTH_SECRET, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 30,
    path:     "/",
  });
  return res;
}
