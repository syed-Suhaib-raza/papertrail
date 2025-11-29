// app/api/issues/[id]/publish/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE env vars', { SUPABASE_URL, SUPABASE_SERVICE_KEY: !!SUPABASE_SERVICE_KEY });
}

const supabase = createClient(
  SUPABASE_URL!,
  SUPABASE_SERVICE_KEY!,
  { auth: { persistSession: false } }
);

function extractIdFromUrl(url: string) {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const publishIdx = parts.lastIndexOf('publish');
    if (publishIdx > 0) return parts[publishIdx - 1];
    const issuesIdx = parts.lastIndexOf('issues');
    if (issuesIdx >= 0 && parts.length > issuesIdx + 1) return parts[issuesIdx + 1];
    return parts[parts.length - 1];
  } catch {
    return null;
  }
}

function isUuidLike(v: unknown) {
  return typeof v === 'string' && v.trim() !== '' && v.toLowerCase() !== 'undefined' && /^[0-9a-fA-F-]{6,}$/.test(v);
}

export async function POST(req: Request, context: { params?: { id?: string } } = {}) {
  // resolve params safely (works if params is a Promise or plain object)
  let resolvedParams: any = context?.params;
  try {
    // @ts-ignore - params may be a Promise in some Next versions
    resolvedParams = await resolvedParams;
  } catch {
    // ignore; fallback to url
  }

  const idFromParams = resolvedParams?.id;
  const idFromUrl = extractIdFromUrl(req.url);
  const id = idFromParams ?? idFromUrl ?? null;

  if (!id || !isUuidLike(id)) {
    return NextResponse.json({ message: 'Missing or invalid issue id' }, { status: 400 });
  }

  try {
    // Ensure issue exists
    const { data: issueRow, error: issueCheckErr } = await supabase
      .from('issues')
      .select('id, published')
      .eq('id', id)
      .maybeSingle();

    if (issueCheckErr) {
      console.error('DB error checking issue', issueCheckErr);
      return NextResponse.json({ message: 'DB error checking issue', details: issueCheckErr.message }, { status: 500 });
    }
    if (!issueRow) {
      return NextResponse.json({ message: 'Issue not found' }, { status: 404 });
    }
    if (issueRow.published) {
      return NextResponse.json({ message: 'Issue already published', issueId: id }, { status: 200 });
    }

    // get linked paper ids
    const { data: links, error: linkErr } = await supabase
      .from('issue_papers')
      .select('paper_id')
      .eq('issue_id', id);

    if (linkErr) {
      console.error('DB error fetching linked papers', linkErr);
      return NextResponse.json({ message: 'DB error fetching linked papers', details: linkErr.message }, { status: 500 });
    }

    const paperIds = (links ?? []).map((l: any) => l.paper_id).filter(Boolean);

    const publishedAt = new Date().toISOString();

    // Attempt to update issue with published_at first; fallback if column missing
    let updatedIssue: any = null;
    try {
      const { data, error } = await supabase
        .from('issues')
        .update({ published: true, published_at: publishedAt })
        .eq('id', id)
        .select()
        .maybeSingle();

      if (error) throw error;
      updatedIssue = data;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      console.warn('Failed to update issues with published_at, retrying without timestamp', { id, msg });
      // If the error mentions published_at (column not found), retry without published_at
      try {
        const { data, error } = await supabase
          .from('issues')
          .update({ published: true })
          .eq('id', id)
          .select()
          .maybeSingle();

        if (error) throw error;
        updatedIssue = data;
      } catch (e2: any) {
        console.error('Failed to publish issue (retry without timestamp also failed)', { id, e2 });
        return NextResponse.json({ message: 'Failed to publish issue', details: e2?.message ?? String(e2) }, { status: 500 });
      }
    }

    if (!updatedIssue) {
      return NextResponse.json({ message: 'Issue not found after update' }, { status: 404 });
    }

    // Update linked papers (if any). Try with published_date, fallback without
    let updatedPaperIds: string[] = [];
    if (paperIds.length) {
      try {
        const { data: updatedPapers, error: updatePapersErr } = await supabase
          .from('papers')
          .update({ status: 'published', published_date: publishedAt })
          .in('id', paperIds)
          .select('id');

        if (updatePapersErr) throw updatePapersErr;
        updatedPaperIds = (updatedPapers ?? []).map((p: any) => p.id).filter(Boolean);
      } catch (errP: any) {
        const msgP = errP?.message ?? String(errP);
        console.warn('Failed to update papers with published_date, retrying without timestamp', { id, msgP });
        // retry without published_date
        try {
          const { data: updatedPapers2, error: updatePapersErr2 } = await supabase
            .from('papers')
            .update({ status: 'published' })
            .in('id', paperIds)
            .select('id');

          if (updatePapersErr2) throw updatePapersErr2;
          updatedPaperIds = (updatedPapers2 ?? []).map((p: any) => p.id).filter(Boolean);
        } catch (errP2: any) {
          // attempt best-effort rollback of issue publish
          console.error('Failed to update papers even after retry; attempting rollback of issue publish', { id, errP2 });
          try {
            await supabase.from('issues').update({ published: false }).eq('id', id);
          } catch (rbErr) {
            console.error('Rollback failed', rbErr);
          }
          return NextResponse.json({ message: 'Failed to publish linked papers', details: errP2?.message ?? String(errP2) }, { status: 500 });
        }
      }
    }

    return NextResponse.json({
      success: true,
      issue: updatedIssue,
      updated_paper_ids: updatedPaperIds,
    });
  } catch (err: any) {
    console.error('Unexpected error in publish route', err);
    return NextResponse.json({ message: 'Server error', details: String(err) }, { status: 500 });
  }
}