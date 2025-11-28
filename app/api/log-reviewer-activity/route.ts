// app/api/log-reviewer-activity/route.ts
import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; // your client that uses user auth

export async function POST(req: Request) {
  const body = await req.json();
  const { reviewer_id, assignment_id, action, details } = body;

  // Supabase client on server should run as the current user (or server-side check)
  // We'll rely on RLS: reviewer_activity_insert policy allows reviewer to insert their own rows.
  const { data, error } = await supabase
    .from('reviewer_activity')
    .insert([{ reviewer_id, assignment_id, action, details }]);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true, inserted: data }, { status: 201 });
}