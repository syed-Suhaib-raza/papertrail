// app/api/papers/[paperId]/versions/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeSupabaseClientWithToken(token: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing');

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });
}

function isNonEmptyString(v: any): v is string {
  return typeof v === 'string' && v.trim() !== '';
}

/**
 * Accept NextRequest and context.params as a Promise per Next's generated types.
 * Await params, fall back to pathname parsing, then proceed with the original logic.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ paperId: string }> }) {
  try {
    const authHeader = request.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Missing authorization token' }, { status: 401 });

    // Resolve paperId from context.params (which may be a Promise) or fallback to pathname parsing
    let paperId: string | undefined;
    try {
      const resolved = await context.params;
      paperId = resolved?.paperId;
    } catch {
      paperId = undefined;
    }

    if (!isNonEmptyString(paperId)) {
      const pathname = (request.nextUrl && request.nextUrl.pathname) || new URL(request.url).pathname;
      const m = pathname.match(/\/api\/papers\/([^\/]+)\/versions\/?$/);
      if (m && m[1]) paperId = decodeURIComponent(m[1]);
    }

    if (!isNonEmptyString(paperId)) {
      return NextResponse.json({ message: 'Invalid or missing paperId' }, { status: 400 });
    }

    const supabaseServer = makeSupabaseClientWithToken(token);

    const raw = await request.json().catch(() => ({}));
    const storage_path = typeof raw.storage_path === 'string' ? raw.storage_path.trim() : null;
    const notes = raw.notes ?? null;
    const file_mime = raw.file_mime ?? null;

    if (!storage_path) return NextResponse.json({ message: 'storage_path required' }, { status: 400 });

    // confirm auth user
    const { data: userData, error: userErr } = await supabaseServer.auth.getUser();
    if (userErr || !userData?.user) {
      console.error('auth.getUser error', userErr);
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    // confirm paper exists & RLS allows access
    const { data: paperRow, error: paperErr } = await supabaseServer
      .from('papers')
      .select('id, current_version')
      .eq('id', paperId)
      .limit(1)
      .single();

    if (paperErr || !paperRow) {
      console.error('Paper lookup failed', paperErr);
      return NextResponse.json({ message: 'Paper not found or access denied' }, { status: 404 });
    }

    // compute next version
    const { data: latest, error: latestErr } = await supabaseServer
      .from('paper_versions')
      .select('version_number')
      .eq('paper_id', paperId)
      .order('version_number', { ascending: false })
      .limit(1);

    if (latestErr) {
      console.error('Failed to read latest version', latestErr);
      return NextResponse.json({ message: 'Failed to read latest version', detail: latestErr }, { status: 500 });
    }

    let nextVersion = 1;
    if (Array.isArray(latest) && latest.length > 0) {
      const highest = (latest[0] as any).version_number ?? null;
      if (typeof highest === 'number') nextVersion = highest + 1;
    }

    // Build payload matching schema exactly
    const payload = {
      paper_id: paperId,
      version_number: nextVersion,
      file_path: storage_path,
      file_mime: file_mime ?? 'application/pdf',
      notes,
      metadata: {}
    };

    const { data: verInsert, error: verErr } = await supabaseServer
      .from('paper_versions')
      .insert([payload])
      .select('*')
      .single();

    if (verErr || !verInsert) {
      console.error('paper_versions insert failed', verErr);
      return NextResponse.json({ message: 'Failed to create version', detail: verErr }, { status: 500 });
    }

    const { error: updErr } = await supabaseServer
      .from('papers')
      .update({ current_version: nextVersion, updated_at: new Date().toISOString() })
      .eq('id', paperId);

    if (updErr) console.warn('Failed to update papers.current_version', updErr);

    return NextResponse.json({ ok: true, version: verInsert });
  } catch (err: any) {
    console.error('version route error', err);
    return NextResponse.json({ message: err?.message || 'Server error', detail: String(err) }, { status: 500 });
  }
}