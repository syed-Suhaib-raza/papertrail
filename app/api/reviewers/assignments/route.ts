// app/api/reviewer/assignments/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env');
}

// Server-side service role client
const srv = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function getUserFromToken(token: string | null) {
  if (!token) return null;
  const { data, error } = await srv.auth.getUser(token);
  if (error || !data?.user) {
    console.error('srv.auth.getUser error', error);
    return null;
  }
  return data.user;
}

export async function GET(req: Request) {
  try {
    // accept Authorization header: "Bearer <token>"
    const tokenHeader = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '') || null;
    if (!tokenHeader) {
      return NextResponse.json({ error: 'Missing Authorization token' }, { status: 401 });
    }

    const user = await getUserFromToken(tokenHeader);
    if (!user) {
      return NextResponse.json({ error: 'Invalid token or user not found' }, { status: 401 });
    }

    // find profile row that links auth user -> profiles.id
    const { data: profileRows, error: profileErr } = await srv
      .from('profiles')
      .select('id, auth_id')
      .eq('auth_id', user.id)
      .limit(1);

    if (profileErr) {
      console.error('Error fetching profile for auth_id', profileErr);
    }

    const profileId = Array.isArray(profileRows) && profileRows.length ? profileRows[0].id : null;
    console.log('GET assignments for auth user id:', user.id, 'profile id:', profileId);

    if (!profileId) {
      // No profile mapping — return empty array with hint so client can show actionable message.
      return NextResponse.json({
        data: [],
        info: 'no_profile',
        message: 'No profile row found linking this auth user to a profiles.id — create a profiles row with auth_id = auth user id'
      });
    }

    // Query assignments where reviewer_id equals profileId
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
      .eq('reviewer_id', profileId)
      .order('due_date', { ascending: true });

    if (assignmentsError) {
      console.error('Error fetching assignments:', assignmentsError);
      return NextResponse.json({ error: 'DB error fetching assignments', details: assignmentsError.message }, { status: 500 });
    }

    const assignments = assignmentsRows || [];

    // fetch latest paper_versions for each paper_id
    const paperIds = Array.from(new Set(assignments.map((a: any) => a.paper_id).filter(Boolean)));
    let latestByPaper: Record<string, any> = {};
    if (paperIds.length) {
      const { data: versionsRows, error: versionsError } = await srv
        .from('paper_versions')
        .select('id, paper_id, version_number, file_path, created_at')
        .in('paper_id', paperIds)
        .order('version_number', { ascending: false });

      if (versionsError) {
        console.error('Error fetching paper_versions:', versionsError);
      } else {
        for (const v of versionsRows || []) {
          if (!latestByPaper[v.paper_id]) latestByPaper[v.paper_id] = v;
        }
      }
    }

    const mapped = assignments.map((a: any) => ({
      ...a,
      latest_version: latestByPaper[a.paper_id] ?? null,
      paper: a.papers ?? null,
    }));

    return NextResponse.json({ data: mapped });
  } catch (err: any) {
    console.error('Unexpected error in assignments route:', err);
    return NextResponse.json({ error: 'internal', message: String(err) }, { status: 500 });
  }
}