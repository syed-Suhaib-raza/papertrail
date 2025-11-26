import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(req: NextRequest) {
  // Extract bearer token sent by the client
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) return NextResponse.json({ message: 'Missing authorization token' }, { status: 401 });

  // Create a Supabase client (uses anon key) and set the user's access token so requests act as the user
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Supabase env vars missing');
    return NextResponse.json({ message: 'Server config error' }, { status: 500 });
  }

  const supabaseServer = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  // set the user's access token so supabaseClient treats requests as that user
  await supabaseServer.auth.setSession({ access_token: token, refresh_token: token });

  // parse JSON body
  const body = await req.json().catch(() => ({}));
  const { title, abstract = null, keywords = null, category_id = null, storage_path = null } = body;

  if (!title || typeof title !== 'string') return NextResponse.json({ message: 'Title required' }, { status: 400 });

  // get user session info via the token
  const { data: { user }, error: userErr } = await supabaseServer.auth.getUser();
  if (userErr || !user) return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });

  // find profile id for auth user (we still query profiles to map auth.id -> profiles.id)
  const { data: profile, error: profileErr } = await supabaseServer
    .from('profiles')
    .select('id')
    .eq('auth_id', user.id)
    .limit(1)
    .single();

  if (profileErr || !profile) {
    console.error('Profile lookup failed', profileErr);
    return NextResponse.json({ message: 'Profile not found' }, { status: 400 });
  }

  // Insert into papers table — RLS will check created_by = current_profile_id() etc.
  const { data: paper, error: insertErr } = await supabaseServer
    .from('papers')
    .insert([
      {
        title: title.trim(),
        abstract,
        keywords,
        category_id: category_id || null,
        created_by: profile.id,
        status: 'submitted'
      }
    ])
    .select('id')
    .single();

  if (insertErr || !paper) {
    console.error('Paper insert failed', insertErr);
    return NextResponse.json({ message: 'Failed to create paper', detail: insertErr?.message }, { status: 500 });
  }

  const paperId = paper.id;

  // If storage_path provided, create a paper_versions record (and paper_files if desired).
  if (storage_path) {
    const v = await supabaseServer.from('paper_versions').insert([
      { paper_id: paperId, version_number: 1, file_path: storage_path, file_mime: 'application/pdf', metadata: JSON.stringify({}), created_by: profile.id }
    ]);
    if (v.error) console.warn('paper_versions insert warning', v.error);

    const f = await supabaseServer.from('paper_files').insert([{ paper_id: paperId, file_name: storage_path.split('/').pop(), url: storage_path }]);
    if (f.error) console.warn('paper_files insert warning', f.error);
  }

  // enqueue a plagiarism check row
  const check = await supabaseServer.from('paper_checks').insert([{ paper_id: paperId, type: 'plagiarism', status: 'queued' }]);
  if (check.error) console.warn('paper_checks insert warning', check.error);

  return NextResponse.json({ ok: true, id: paperId });
}