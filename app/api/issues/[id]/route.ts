// app/api/issues/[id]/route.ts
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
    // expecting .../api/issues/:id
    const issuesIdx = parts.lastIndexOf('issues');
    if (issuesIdx >= 0 && parts.length > issuesIdx + 1) return parts[issuesIdx + 1];
    return parts[parts.length - 1] ?? null;
  } catch {
    return null;
  }
}

function isUuidLike(v: unknown) {
  if (typeof v !== 'string') return false;
  const s = v.trim().toLowerCase();
  if (s === '' || s === 'undefined' || s === 'null') return false;
  return /^[0-9a-fA-F-]{6,}$/.test(s);
}

/**
 * Note: context may contain `params` which in some Next versions is a Promise.
 * We accept context as optional and safely await params if necessary.
 */
export async function GET(req: Request, context: { params?: { id?: string } } = {}) {
  // Resolve params safely (works whether params is a Promise or plain object)
  let resolvedParams: any = context?.params;
  try {
    // @ts-ignore - params can be a Promise in some Next versions
    resolvedParams = await resolvedParams;
  } catch {
    // ignore - we'll fallback to URL parsing below
  }

  const idFromParams = resolvedParams?.id;
  const idFromUrl = extractIdFromUrl(req.url);
  const id = idFromParams ?? idFromUrl ?? null;

  console.log('GET /api/issues/[id] resolved id:', { idFromParams, idFromUrl, final: id });

  if (!id || !isUuidLike(id)) {
    return NextResponse.json({ message: 'Missing or invalid issue id' }, { status: 400 });
  }

  try {
    const { data, error } = await supabase
      .from('issues')
      .select('id, title, slug, volume, issue_number, scheduled_release_date, published, created_at')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('DB error fetching issue', { id, message: error.message });
      return NextResponse.json({ message: 'DB error', details: error.message }, { status: 500 });
    }

    if (!data) {
      console.info('Issue not found', { id });
      return NextResponse.json({ message: 'Issue not found' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Unexpected error in GET /api/issues/[id]', { err, id });
    return NextResponse.json({ message: 'Server error', details: String(err) }, { status: 500 });
  }
}