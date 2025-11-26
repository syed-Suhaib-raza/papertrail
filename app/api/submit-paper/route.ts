// app/api/submit-paper/route.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function makeSupabaseClientWithToken(token: string) {
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Supabase env vars missing');

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });
}

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ message: 'Missing authorization token' }, { status: 401 });

    const supabaseServer = makeSupabaseClientWithToken(token);

    const body = await req.json().catch(() => ({}));
    const { title, abstract = null, keywords = null, category_id = null, storage_path = null } = body;

    if (!title || typeof title !== 'string') return NextResponse.json({ message: 'Title required' }, { status: 400 });

    // ensure user is valid (this runs as the bearer token user)
    const { data: userData, error: userErr } = await supabaseServer.auth.getUser();
    if (userErr || !userData?.user) {
      console.error('auth.getUser error', userErr);
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    // Try inserting the paper WITHOUT created_by — DB trigger will fill created_by = current_profile_id()
    const { data: paper, error: insertErr } = await supabaseServer
      .from('papers')
      .insert([
        {
          title: title.trim(),
          abstract,
          keywords,
          category_id: category_id || null,
          status: 'submitted'
        }
      ])
      .select('id')
      .single();

    if (insertErr || !paper) {
      console.error('Paper insert failed', insertErr);
      return NextResponse.json({ message: 'Failed to create paper', detail: insertErr }, { status: 500 });
    }

    const paperId = paper.id;

    if (storage_path) {
      const v = await supabaseServer.from('paper_versions').insert([
        {
          paper_id: paperId,
          version_number: 1,
          file_path: storage_path,
          file_mime: 'application/pdf',
          metadata: JSON.stringify({}),
        }
      ]);
      if (v.error) console.warn('paper_versions insert warning', v.error);
    }

    const check = await supabaseServer.from('paper_checks').insert([{ paper_id: paperId, type: 'plagiarism', status: 'queued' }]);
    if (check.error) console.warn('paper_checks insert warning', check.error);

    return NextResponse.json({ ok: true, id: paperId });
  } catch (err: any) {
    console.error('submit-paper route error', err);
    return NextResponse.json({ message: err?.message || 'Server error', detail: err }, { status: 500 });
  }
}
