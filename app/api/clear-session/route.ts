// /app/api/clear-session/route.ts
import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // set cookie to expired
  const cookie = [
    "sb-access-token=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") cookie.push("Secure");
  res.headers.append("Set-Cookie", cookie.join("; "));
  return res;
}