// middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function decodeJwtPayload(token: string | undefined) {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payloadB64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // add padding
    const pad = payloadB64.length % 4;
    const padded = payloadB64 + (pad ? "=".repeat(4 - pad) : "");
    // atob may be available in Edge; use Buffer if available
    let json: string;
    if (typeof atob === "function") {
      json = decodeURIComponent(
        Array.from(atob(padded))
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
    } else if (typeof Buffer !== "undefined") {
      json = Buffer.from(padded, "base64").toString("utf8");
    } else {
      return null;
    }
    return JSON.parse(json);
  } catch (e) {
    console.warn("decodeJwtPayload failed", e);
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl.clone();

  // read cookie (match cookie name used by save-token)
  const accessToken = req.cookies.get("sb-access-token")?.value;

  if (!accessToken) {
    // no cookie -> go to login
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const payload = decodeJwtPayload(accessToken);
  if (!payload?.sub) {
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // attempt to fetch role from profiles via REST
  // This is optional – if middleware only needs to allow presence of session you can skip
  try {
    const userId = payload.sub;
    const restUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/profiles?select=role&auth_id=eq.${userId}`;
    const resp = await fetch(restUrl, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (!resp.ok) {
      console.warn("profiles fetch failed in middleware", resp.status);
    } else {
      const rows = await resp.json();
      const role = rows?.[0]?.role ?? null;

      const path = req.nextUrl.pathname;

      if (path.startsWith("/dashboard/submissions")) {
        if (!["author", "admin"].includes(role)) {
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }

      if (path.startsWith("/dashboard/review")) {
        if (!["reviewer", "admin"].includes(role)) {
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }

      if (path.startsWith("/dashboard/editorial")) {
        if (!["editor", "admin"].includes(role)) {
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }

      if (path.startsWith("/dashboard/admin")) {
        if (role !== "admin") {
          url.pathname = "/dashboard";
          return NextResponse.redirect(url);
        }
      }
    }
  } catch (err) {
    console.warn("middleware: role check failed", err);
    // fallthrough: allow if token present (but you may want to be stricter)
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};