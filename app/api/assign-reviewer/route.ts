import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(req: Request) {
  try {
    // Read incoming body
    const body = await req.json();
    const { paperId, reviewerId, dueDate, priority } = body;
    if (!paperId || !reviewerId) {
      return NextResponse.json({ error: 'Missing paperId or reviewerId' }, { status: 400 });
    }

    // read headers
    const cookieHeader = req.headers.get('cookie') ?? null;
    const authHeader = req.headers.get('authorization') ?? null;
    const accessToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.replace(/^Bearer\s+/i,'') : null;

    // Build anon client that accepts forwarded cookie or Authorization
    const client = createClient(SUPABASE_URL, SUPABASE_ANON, {
      auth: { persistSession: false },
      global: {
        headers: {
          ...(cookieHeader ? { cookie: cookieHeader } : {}),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        }
      }
    });

    // Try to get user
    const { data: userData, error: userErr } = await client.auth.getUser();

    // In dev mode provide debugging details
    const isDev = process.env.NODE_ENV !== 'production';

    if (!userData?.user) {
      if (isDev) {
        // Give actionable debug info for the client
        return NextResponse.json({
          ok: false,
          reason: 'no_user',
          message: 'auth.getUser() returned no user. Check cookie or Authorization header.',
          received: {
            cookieHeaderPresent: !!cookieHeader,
            authHeaderPresent: !!authHeader,
            authHeaderSample: authHeader ? authHeader.slice(0,20) + '...' : null,
            userErr: userErr ? { message: userErr.message, status: (userErr as any).status || null } : null
          }
        }, { status: 401 });
      } else {
        return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      }
    }

    // Confirm profile exists and role
    const { data: profile, error: profErr } = await client
      .from('profiles')
      .select('id, role')
      .eq('auth_id', userData.user.id)
      .single();

    if (profErr || !profile) {
      if (isDev) {
        return NextResponse.json({
          ok: false,
          reason: 'no_profile',
          message: 'Could not load profile for auth user',
          received: { userId: userData.user.id, profErr: profErr ? profErr.message : null }
        }, { status: 403 });
      }
      return NextResponse.json({ error: 'Could not load profile' }, { status: 403 });
    }

    if (!(profile.role === 'editor' || profile.role === 'admin')) {
      return NextResponse.json({ error: 'Forbidden: only editors/admins' }, { status: 403 });
    }

    // Service client for insert
    const service = createClient(SUPABASE_URL, SUPABASE_SERVICE);
    const { error: insertError } = await service
      .from('review_assignments')
      .insert({
        paper_id: paperId,
        reviewer_id: reviewerId,
        assigned_by: profile.id,
        due_date: dueDate || null,
        priority: priority || 'normal',
        expertise_match_score: 100,
        notes: null
      });

    if (insertError) {
      return NextResponse.json({ ok: false, reason: 'insert_failed', error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, success: true });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || String(err) }, { status: 500 });
  }
}