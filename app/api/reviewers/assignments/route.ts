// app/api/reviewer/assignments/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
}
const srv = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getUserFromToken(token: string | null) {
  if (!token) return null;
  const { data, error } = await srv.auth.getUser(token);
  console.log(data);
  if (error || !data?.user) return null;
  return data.user;
}

export async function GET(req: Request) {
  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
    if (!token) return NextResponse.json({ error: 'Missing Authorization token' }, { status: 401 });

    const user = await getUserFromToken(token);
    if (!user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    // Look up profile_id (if you have a profiles table linking auth_id -> profile id)
    const { data: profileRows, error: profileErr } = await srv
      .from('profiles')
      .select('id, auth_id')
      .eq('auth_id', user.id)
      .limit(1);

    if (profileErr) {
      console.error('Error fetching profile for auth_id', profileErr);
      // continue — we can still try with auth user id
    }

    const profileId = Array.isArray(profileRows) && profileRows.length ? profileRows[0].id : null;

    // Query assignments where reviewer_id matches either the auth user id OR the profile id
    // (this handles whichever approach your DB uses)
    const reviewerCandidates = [user.id];
    console.log('Profile ID:', profileId);
    if (profileId && profileId !== user.id) reviewerCandidates.push(profileId);

    const { data: assignmentsRows, error: assignmentsError } = await srv
      .from('review_assignments')
      .select(`
        id,
        paper_id,
        reviewer_id,
        assigned_at,
        due_date,
        status,
        priority,
        expertise_match_score,
        notes,
        papers ( id, title, abstract, current_version, status )
      `)
      .in('reviewer_id', reviewerCandidates)
      .order('due_date', { ascending: true });

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return NextResponse.json({ error: 'DB error fetching assignments', details: assignmentsError.message }, { status: 500 });
    }

    const assignments = (assignmentsRows || []) as any[];

    if (!assignments.length) {
      // no assignments found — return empty array (client can show helpful message)
      return NextResponse.json({ data: [] });
    }

    // fetch latest versions for each paper_id (two-step)
    const paperIds = Array.from(new Set(assignments.map(a => a.paper_id).filter(Boolean)));
    let latestByPaper: Record<string, any> = {};
    if (paperIds.length) {
      const { data: versionsRows, error: versionsError } = await srv
        .from('paper_versions')
        .select('id, paper_id, version_number, file_path, created_at')
        .in('paper_id', paperIds)
        .order('version_number', { ascending: false });

      if (versionsError) {
        console.error('Error fetching paper_versions:', versionsError);
        // proceed with null latest_version
      } else {
        for (const v of versionsRows || []) {
          if (!latestByPaper[v.paper_id]) latestByPaper[v.paper_id] = v;
        }
      }
    }

    const mapped = assignments.map(a => ({
      ...a,
      latest_version: latestByPaper[a.paper_id] ?? null,
      paper: a.papers ?? null
    }));

    return NextResponse.json({ data: mapped });
  } catch (err: any) {
    console.error('Unexpected error in assignments route:', err);
    return NextResponse.json({ error: 'internal', message: String(err) }, { status: 500 });
  }
}
