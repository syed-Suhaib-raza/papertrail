// app/api/issues/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // validate minimal fields (adjust as needed)
    if (!body.title) return NextResponse.json({ message: 'title required' }, { status: 400 });

    const { data, error } = await supabase
      .from('issues')
      .insert([body])
      .select()
      .single();

    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('issues')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ message: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ message: err.message || 'Server error' }, { status: 500 });
  }
}