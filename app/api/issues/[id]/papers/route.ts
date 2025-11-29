// app/api/issues/[id]/papers/route.ts
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
    const papersIdx = parts.lastIndexOf('papers');
    if (papersIdx > 0) return parts[papersIdx - 1];
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
 * Accept NextRequest and context.params as a Promise (per Next's generated types),
 * then await the params and continue with the existing logic.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  // resolve params promise (Next may provide a Promise here)
  let idFromParams: string | undefined;
  try {
    const resolved = await context.params;
    idFromParams = resolved?.id;
  } catch {
    idFromParams = undefined;
  }

  const idFromUrl = extractIdFromUrl(request.url);
  const issueId = idFromParams ?? idFromUrl ?? null;

  console.log('Resolved issueId:', issueId);

  if (!issueId || !isUuidLike(issueId)) {
    return NextResponse.json({ message: 'Missing or invalid issue id' }, { status: 400 });
  }

  try {
    // fetch paper links
    const { data: links, error: linkErr } = await supabase
      .from('issue_papers')
      .select('paper_id, position')
      .eq('issue_id', issueId)
      .order('position', { ascending: true });

    if (linkErr) {
      console.error('DB error fetching issue_papers', linkErr);
      return NextResponse.json({ message: linkErr.message }, { status: 500 });
    }

    const paperIds = (links ?? []).map((l: any) => l.paper_id).filter(Boolean);

    if (!paperIds.length) {
      // No linked papers
      return NextResponse.json([]);
    }

    // Fetch papers by array of ids
    const { data: papers, error: papersErr } = await supabase
      .from('papers')
      .select('id, title, status, created_by')
      .in('id', paperIds);

    if (papersErr) {
      console.error('DB error fetching papers', papersErr);
      return NextResponse.json({ message: papersErr.message }, { status: 500 });
    }

    // preserve original order by mapping paperIds
    const papersById = (papers ?? []).reduce((acc: Record<string, any>, p: any) => {
      acc[p.id] = p;
      return acc;
    }, {});
    const ordered = paperIds.map((pid: string) => papersById[pid]).filter(Boolean);

    return NextResponse.json(ordered);
  } catch (err: any) {
    console.error('Unexpected error in GET /api/issues/[id]/papers', err);
    return NextResponse.json({ message: 'Server error', details: String(err) }, { status: 500 });
  }
}