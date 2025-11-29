// app/api/issues/[id]/candidates/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function extractIdFromUrl(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const candidatesIdx = parts.lastIndexOf('candidates');
    if (candidatesIdx > 0) return parts[candidatesIdx - 1];
    const issuesIdx = parts.lastIndexOf('issues');
    if (issuesIdx >= 0 && parts.length > issuesIdx + 1) return parts[issuesIdx + 1];
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

function isUuidLike(v: unknown) {
  if (typeof v !== 'string') return false;
  if (v.trim() === '') return false;
  if (v.toLowerCase() === 'undefined') return false;
  return /^[0-9a-fA-F-]{6,}$/.test(v);
}

/**
 * Next's generated route types expect `context.params` to be a Promise for dynamic routes.
 * So accept `context: { params: Promise<{ id: string }> }` and await it.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // resolve params (works if Next provides a Promise)
  let idFromParams: string | undefined;
  try {
    const resolved = await context.params;
    idFromParams = resolved?.id;
  } catch {
    idFromParams = undefined;
  }

  const idFromUrl = extractIdFromUrl(request.url);
  const issueId = idFromParams ?? idFromUrl ?? null;

  if (!issueId || !isUuidLike(issueId)) {
    return NextResponse.json({ message: 'Missing or invalid issue id' }, { status: 400 });
  }

  try {
    // 1) fetch already-assigned paper ids
    const { data: assigned, error: assignedErr } = await supabase
      .from('issue_papers')
      .select('paper_id')
      .eq('issue_id', issueId);

    if (assignedErr) {
      return NextResponse.json({ message: 'DB error fetching assigned papers', details: assignedErr.message }, { status: 500 });
    }

    const alreadyIds = (assigned ?? []).map((r: any) => r.paper_id).filter(Boolean);

    // 2) fetch candidate papers (accepted/published)
    const { data: candidates, error: candidatesErr } = await supabase
      .from('papers')
      .select('id, title, status')
      .in('status', ['accepted', 'published']);

    if (candidatesErr) {
      return NextResponse.json({ message: 'DB error fetching candidate papers', details: candidatesErr.message }, { status: 500 });
    }

    // 3) filter out already-assigned in JS (safe & simple)
    const filtered = (candidates ?? []).filter((p: any) => !alreadyIds.includes(p.id));

    return NextResponse.json(filtered);
  } catch (err: any) {
    console.error('Unexpected error in candidates route', err);
    return NextResponse.json({ message: 'Server error', details: String(err) }, { status: 500 });
  }
}