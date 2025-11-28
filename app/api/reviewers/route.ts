// app/api/reviewers/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// client used to validate caller session (relies on cookies/session)
const clientSupabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false }
});

// service role client to bypass RLS for server tasks
const serviceSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);

export async function GET(req: Request) {
  try {

    // 3) optional query params: ?categoryId=... & ?onlyAvailable=true
    const url = new URL(req.url);
    const categoryId = url.searchParams.get('categoryId');

    let q = serviceSupabase
      .from('profiles')
      .select('id, full_name, email, spec, affiliation')
      .eq('role', 'reviewer');

    if (categoryId) q = q.eq('spec', Number(categoryId));

    const { data: reviewers, error: revErr } = await q;
    if (revErr) {
      console.error('service select reviewers error', revErr);
      return NextResponse.json({ error: revErr.message }, { status: 500 });
    }
    const safe = (reviewers || []).map((r: any) => ({
      id: r.id,
      full_name: r.full_name,
      spec: r.spec ?? null,
    }));

    return NextResponse.json({ reviewers: safe });
  } catch (err: any) {
    console.error('GET /api/reviewers unexpected', err);
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}