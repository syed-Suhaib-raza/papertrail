// app/dashboard/review/[id]/coi/page.tsx  (server component)
import COIForm from '@/components/paper/coi-form';
import { createClient } from '@supabase/supabase-js';
import React from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // must be present on server env

// server-side/admin client (bypasses RLS)
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

export default async function ReviewerCOIPage({ params }: { params: any }) {
  // resolve possible promise params
  const resolved = await params;
  const rawId = resolved?.id;
  const assignmentId = Array.isArray(rawId) ? rawId[0] : rawId;

  if (!assignmentId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Reviewer COI Declaration</h1>
        <div className="text-red-600">Missing assignment id in route params.</div>
      </div>
    );
  }

  // fetch assignment via admin client (server-side)
  const { data, error } = await supabaseAdmin
    .from('review_assignments')
    .select('paper_id')
    .eq('id', assignmentId)
    .limit(1); // defensive: avoid single() coercion error

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Reviewer COI Declaration</h1>
        <div className="text-red-600">DB error: {error.message}</div>
      </div>
    );
  }

  if (!data || !Array.isArray(data) || data.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Reviewer COI Declaration</h1>
        <div className="text-red-600">Assignment not found.</div>
      </div>
    );
  }

  if (data.length > 1) {
    console.warn(`Multiple assignments found for id=${assignmentId}; using the first one.`);
  }

  const assignment = data[0];
  const paperId = assignment?.paper_id as string | undefined;

  if (!paperId) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Reviewer COI Declaration</h1>
        <div className="text-red-600">Assignment is missing a paper_id.</div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Reviewer COI Declaration</h1>
      <COIForm paperId={paperId} role="reviewer" />
    </div>
  );
}