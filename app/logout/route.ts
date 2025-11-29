// app/logout/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export async function POST() {
    const res = NextResponse.json({ ok: true });
  await supabase.auth.signOut();
  const cookie = [
    "sb-access-token=",
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
  ];
  if (process.env.NODE_ENV === "production") cookie.push("Secure");
  res.headers.append("Set-Cookie", cookie.join("; "));
  NextResponse.redirect(new URL("/", process.env.NEXT_PUBLIC_VERCEL_URL || "http://localhost:3000"));
  return res;
}
