// app/api/reviewers/assignments/[id]/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!; // server-only
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
}
const srv = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getUserFromToken(token: string | null) {
  if (!token) return null;
  const { data, error } = await srv.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}

/**
 * GET: returns assignment details (uses maybeSingle to avoid throwing)
 * Note: `context.params` may be a Promise so we `await` it before using.
 */
export async function GET(req: Request, context: { params: any }) {
  try {
    const params = await context.params;
    const assignmentId = params?.id;

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Get assignment by id (maybeSingle avoids throwing when not found)
    const { data, error } = await srv
      .from('review_assignments')
      .select(`*, papers ( id, title, abstract, current_version )`)
      .eq('id', assignmentId)
      .maybeSingle();

    if (!data || error) {
      // Not found by assignment id — return helpful debug info
      const { data: byPaper } = await srv
        .from('review_assignments')
        .select('id, paper_id, reviewer_id, status, assigned_at')
        .eq('paper_id', assignmentId)
        .limit(5);

      const { data: recentForUser } = await srv
        .from('review_assignments')
        .select('id, paper_id, reviewer_id, status, assigned_at')
        .eq('reviewer_id', user.id)
        .order('assigned_at', { ascending: false })
        .limit(10);

      return NextResponse.json({
        error: 'Assignment not found by id',
        assignmentIdReceived: assignmentId,
        userId: user.id,
        byPaperMatches: byPaper ?? [],
        recentForUser: recentForUser ?? [],
        dbError: error ? { message: error.message, details: (error as any).details ?? null } : null
      }, { status: 404 });
    }

    // Ownership check: reviewer_id might be either auth user id or profile id.
    const { data: profileRows } = await srv
      .from('profiles')
      .select('id, auth_id')
      .eq('auth_id', user.id)
      .limit(1);

    const profileId = Array.isArray(profileRows) && profileRows.length ? profileRows[0].id : null;
    const allowedReviewerIds = [user.id];
    if (profileId && profileId !== user.id) allowedReviewerIds.push(profileId);

    if (!allowedReviewerIds.includes(data.reviewer_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch latest version for the paper (if any)
    let latest = null;
    if (data.paper_id) {
      const { data: versionsRows } = await srv
        .from('paper_versions')
        .select('id, paper_id, version_number, file_path, created_at')
        .eq('paper_id', data.paper_id)
        .order('version_number', { ascending: false })
        .limit(1);

      if (Array.isArray(versionsRows) && versionsRows.length) latest = versionsRows[0];
    }

    return NextResponse.json({ data: { ...data, latest_version: latest, paper: data.papers } });
  } catch (err: any) {
    console.error('assignments/[id] GET error:', err);
    return NextResponse.json({ error: 'internal', message: String(err) }, { status: 500 });
  }
}

/**
 * POST: update status or submit review
 * await context.params then proceed
 */
export async function POST(req: Request, context: { params: any }) {
  try {
    const params = await context.params;
    const assignmentId = params?.id;

    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body || {};

    // Try to fetch assignment by id (maybeSingle)
    const { data: assgn, error: assgnErr } = await srv
      .from('review_assignments')
      .select('*')
      .eq('id', assignmentId)
      .maybeSingle();

    if (!assgn) {
      // Not found by assignment id — try common fallbacks to help debugging.
      const { data: byPaper } = await srv
        .from('review_assignments')
        .select('id, paper_id, reviewer_id, status, assigned_at')
        .eq('paper_id', assignmentId)
        .limit(5);

      const { data: recentForUser } = await srv
        .from('review_assignments')
        .select('id, paper_id, reviewer_id, status, assigned_at')
        .eq('reviewer_id', user.id)
        .order('assigned_at', { ascending: false })
        .limit(10);

      return NextResponse.json({
        error: 'Assignment not found by id',
        assignmentIdReceived: assignmentId,
        actionReceived: action ?? null,
        payloadReceived: payload ?? null,
        userId: user.id,
        byPaperMatches: byPaper ?? [],
        recentForUser: recentForUser ?? [],
        dbError: assgnErr ? { message: assgnErr.message, details: (assgnErr as any).details ?? null } : null
      }, { status: 404 });
    }

    // verify reviewer ownership (handle profiles.auth_id -> profiles.id mapping)
    const { data: profileRows } = await srv
      .from('profiles')
      .select('id, auth_id')
      .eq('auth_id', user.id)
      .limit(1);

    const profileId = Array.isArray(profileRows) && profileRows.length ? profileRows[0].id : null;
    const allowedReviewerIds = [user.id];
    if (profileId && profileId !== user.id) allowedReviewerIds.push(profileId);

    if (!allowedReviewerIds.includes(assgn.reviewer_id)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Allowed — now process actions
    if (action === 'update_status') {
      const { status } = payload || {};
      const { error: updErr } = await srv
        .from('review_assignments')
        .update({ status })
        .eq('id', assignmentId);

      if (updErr) {
        console.error('Failed to update status', updErr);
        return NextResponse.json({ error: 'Failed to update status', details: updErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true });
    }

    // Allowed — now process actions
if (action === 'submit_review') {
  const { review_text, overall_score, recommendation, is_anonymous } = payload || {};
  if (!review_text || review_text.trim().length < 10) {
    return NextResponse.json({ error: 'Review text too short' }, { status: 400 });
  }

  // IMPORTANT: use assgn.reviewer_id (the DB value) to satisfy foreign key constraints.
  // assgn.reviewer_id may be a profiles.id or auth.users.id depending on how your DB is designed.
  const insertObj = {
    assignment_id: assignmentId,
    paper_id: assgn.paper_id,
    reviewer_id: assgn.reviewer_id, // <-- use DB's reviewer id (not user.id)
    review_text,
    overall_score: overall_score ?? null,
    recommendation: recommendation ?? null,
    is_anonymous: !!is_anonymous,
    submitted_at: new Date().toISOString(),
  };

  const { data: reviewRow, error: revErr } = await srv
    .from('reviews')
    .insert([insertObj])
    .select()
    .maybeSingle();

  if (revErr) {
    console.error('Error inserting review', revErr);
    return NextResponse.json({ error: 'Failed to insert review', details: revErr.message }, { status: 500 });
  }

  // mark assignment submitted
  const { error: updErr2 } = await srv
    .from('review_assignments')
    .update({ status: 'submitted' })
    .eq('id', assignmentId);

  if (updErr2) {
    console.error('Error updating assignment status', updErr2);
    return NextResponse.json({ ok: true, warning: 'Review saved but failed to update assignment status' });
  }

  return NextResponse.json({ ok: true, review: reviewRow });
}


    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (err: any) {
    console.error('assignments/[id] POST error:', err);
    return NextResponse.json({ error: 'Internal server error', message: String(err) }, { status: 500 });
  }
}
