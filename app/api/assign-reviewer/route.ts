import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { paperId, reviewerId, dueDate, priority } = body;

    if (!paperId || !reviewerId) {
      return NextResponse.json(
        { error: "Missing paperId or reviewerId" },
        { status: 400 }
      );
    }

    // Fetch editor profile (assigned_by)
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: editor } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('auth_id', user.id)
      .single();

    if (!editor || (editor.role !== 'editor' && editor.role !== 'admin')) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    const { error: insertError } = await supabase
      .from('review_assignments')
      .insert({
        paper_id: paperId,
        reviewer_id: reviewerId,
        assigned_by: editor.id,
        due_date: dueDate || null,
        priority: priority || 'normal',
        expertise_match_score: null,
        notes: null
      });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err }, { status: 500 });
  }
}