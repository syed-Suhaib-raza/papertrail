// app/api/coi/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; 
// IMPORTANT: NEVER expose to client
// Must ONLY exist in server environment

// Service-level Supabase client (bypasses RLS entirely)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paperId, role, statement, userId } = body ?? {};

    if (!paperId || !role || !userId) {
      return NextResponse.json(
        { error: 'paperId, role, and userId are required' },
        { status: 400 }
      );
    }

    // Insert directly using service key
    const { data, error } = await supabaseAdmin
      .from('coi_declarations')
      .insert({
        user_id: userId,
        paper_id: paperId,
        role,
        statement: statement ?? '',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: 'Insert failed', details: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Server error', details: String(err) },
      { status: 500 }
    );
  }
}