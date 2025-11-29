// app/api/issues/[id]/add-paper/route.ts
import { NextResponse } from 'next/server';
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
    // expecting .../api/issues/:id/add-paper
    const addIdx = parts.lastIndexOf('add-paper');
    if (addIdx > 0) return parts[addIdx - 1];
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
  // coarse check to avoid obviously wrong values
  return /^[0-9a-fA-F-]{6,}$/.test(v);
}

export async function POST(req: Request, { params }: { params?: { id?: string } } = {}) {
  // 1) resolve params (handles Promise or plain object)
  let resolvedParams: any = params;
  try {
    // if params is a Promise, await it; otherwise this resolves immediately
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    resolvedParams = await params;
  } catch {
    // ignore - we'll fallback to URL parsing below
  }

  const idFromParams = resolvedParams?.id;
  const idFromUrl = extractIdFromUrl(req.url);
  const issueId = idFromParams ?? idFromUrl ?? null;

  if (!issueId || !isUuidLike(issueId)) {
    return NextResponse.json({ message: 'Missing or invalid issue id' }, { status: 400 });
  }

  try {
    // parse body
    const body = await req.json().catch(() => ({}));
    const { paper_id } = body ?? {};
    if (!paper_id || !isUuidLike(paper_id)) {
      return NextResponse.json({ message: 'paper_id required and must be a valid id' }, { status: 400 });
    }

    // ensure paper exists
    const { data: paperRow, error: paperErr } = await supabase
      .from('papers')
      .select('id')
      .eq('id', paper_id)
      .maybeSingle();

    if (paperErr) {
      return NextResponse.json({ message: 'DB error checking paper', details: paperErr.message }, { status: 500 });
    }
    if (!paperRow) {
      return NextResponse.json({ message: 'Paper not found' }, { status: 404 });
    }

    // ensure issue exists
    const { data: issueRow, error: issueErr } = await supabase
      .from('issues')
      .select('id')
      .eq('id', issueId)
      .maybeSingle();

    if (issueErr) {
      return NextResponse.json({ message: 'DB error checking issue', details: issueErr.message }, { status: 500 });
    }
    if (!issueRow) {
      return NextResponse.json({ message: 'Issue not found' }, { status: 404 });
    }

    // compute next position (optional)
    const { data: last, error: lastErr } = await supabase
      .from('issue_papers')
      .select('position')
      .eq('issue_id', issueId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) {
      return NextResponse.json({ message: 'DB error', details: lastErr.message }, { status: 500 });
    }
    const nextPos = last ? (last.position ?? 0) + 1 : 1;

    // insert link. Use insert array and handle unique constraint (duplicate paper)
    const { data, error } = await supabase
      .from('issue_papers')
      .insert([{ issue_id: issueId, paper_id, position: nextPos }])
      .select()
      .maybeSingle();

    if (error) {
      // Unique / FK / other constraints bubble up here. Detect dup by message if possible.
      const msg = error.message ?? String(error);
      if (msg.toLowerCase().includes('duplicate') || msg.toLowerCase().includes('unique')) {
        return NextResponse.json({ message: 'Paper already added to this issue' }, { status: 409 });
      }
      return NextResponse.json({ message: 'Failed to add paper', details: msg }, { status: 400 });
    }

    return NextResponse.json(data ?? { issue_id: issueId, paper_id, position: nextPos });
  } catch (err: any) {
    console.error('Unexpected error in add-paper route', err);
    return NextResponse.json({ message: 'Server error', details: String(err) }, { status: 500 });
  }
}