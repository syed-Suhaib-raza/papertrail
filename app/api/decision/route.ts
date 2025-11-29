// app/api/editor/decision/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

export async function POST(req: Request) {
  try {
    // 1. Get token from Authorization
    const authHeader = req.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
    }

    // 2. Create auth client using token (for verifying the caller)
    const supabaseForAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // 3. Verify user identity
    const { data: userData, error: userErr } = await supabaseForAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const user = userData.user;

    // 4. Parse request body
    const body = await req.json();
    const { paperId, action } = body ?? {};

    if (!paperId || !action) {
      return NextResponse.json({ error: 'paperId and action required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // 5. Fetch profile (check role)
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('auth_id', user.id)
      .maybeSingle();

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!['editor', 'admin'].includes(profile.role)) {
      return NextResponse.json({ error: 'Forbidden: Editors only' }, { status: 403 });
    }

    // ===================================================================
    // ACTION: REJECT
    // ===================================================================
    if (action === 'reject') {
      const { error: updErr } = await supabaseAdmin
        .from('papers')
        .update({ status: 'rejected' })
        .eq('id', paperId);

      if (updErr) {
        return NextResponse.json({ error: 'Failed to reject', details: updErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'rejected', paperId });
    }

    // ===================================================================
    // ACTION: APPROVE -> mark as 'accepted' ONLY
    // ===================================================================
    if (action === 'approve') {
      const { error: updErr } = await supabaseAdmin
        .from('papers')
        .update({ status: 'accepted' })
        .eq('id', paperId);

      if (updErr) {
        return NextResponse.json({ error: 'Failed to accept paper', details: updErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true, action: 'accepted', paperId });
    }

    // shouldn't reach here
    return NextResponse.json({ error: 'Unhandled action' }, { status: 400 });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: 'Server error', details: String(err) }, { status: 500 });
  }
}