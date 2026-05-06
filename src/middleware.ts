import { NextRequest, NextResponse } from "next/server";

const AUTH_SECRET = "8e070762468605bf20d3a821e0c67771173cf140cabf14a170dc30f165594da7";
const PUBLIC      = ["/login", "/api/auth"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get("dash_auth")?.value;
  if (token === AUTH_SECRET) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
