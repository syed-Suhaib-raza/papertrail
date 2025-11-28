// /app/api/save-token/route.ts
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const token = body?.access_token;
    const expires_at = body?.expires_at; // optional (seconds since epoch)

    if (!token) return NextResponse.json({ error: "missing token" }, { status: 400 });

    // compute max-age (seconds)
    let maxAge = 60 * 60 * 24 * 7; // default 7 days
    if (typeof expires_at === "number") {
      const secsLeft = expires_at - Math.floor(Date.now() / 1000);
      if (secsLeft > 0) maxAge = secsLeft;
    }

    // In dev on http://localhost you must NOT set Secure; in production keep Secure.
    const isProd = process.env.NODE_ENV === "production";
    const cookieParts = [
      `sb-access-token=${token}`,
      `Path=/`,
      `HttpOnly`,
      `SameSite=Lax`,
      `Max-Age=${maxAge}`,
    ];
    if (isProd) cookieParts.push("Secure");

    const res = NextResponse.json({ ok: true });
    res.headers.append("Set-Cookie", cookieParts.join("; "));
    return res;
  } catch (err) {
    console.error("save-token error", err);
    return NextResponse.json({ error: "server error" }, { status: 500 });
  }
}