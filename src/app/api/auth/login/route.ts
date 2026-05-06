import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";

function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({}));

  if (!password || sha256(password) !== process.env.DASHBOARD_PASSWORD_HASH) {
    return NextResponse.json({ error: "invalid_password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("dash_auth", process.env.AUTH_SECRET ?? "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge:   60 * 60 * 24 * 30, // 30 days
    path:     "/",
  });
  return res;
}
