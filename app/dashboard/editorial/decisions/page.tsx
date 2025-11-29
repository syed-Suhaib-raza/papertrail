// app/dashboard/editorial/decisions/page.tsx
import React from 'react';
import { createClient } from '@supabase/supabase-js';
import DecisionButtons from '@/components/paper/DecisionButtons';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only env

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

type AssignmentRow = {
  id: string;
  paper_id: string;
  reviewer_id: string;
  assigned_at: string | null;
  status: string;
  papers?: any;
  reviewers?: any;
  reviews?: any;
};

export default async function DecisionsIndexPage() {
  // Fetch review assignments with submitted reviews
  const { data: assignmentsData, error: assignmentsErr } = await supabaseAdmin
    .from('review_assignments')
    .select(`
      id,
      paper_id,
      reviewer_id,
      assigned_at,
      status,
      papers:paper_id ( id, title, abstract, status, created_at, created_by ),
      reviewers:reviewer_id ( id, full_name, email ),
      reviews:reviews ( id, assignment_id, reviewer_id, review_text, overall_score, recommendation, submitted_at )
    `)
    .eq('status', 'submitted')
    .order('assigned_at', { ascending: false });

  if (assignmentsErr) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Decisions — Submitted Reviews</h1>
        <div className="mt-4 text-red-600">DB error: {assignmentsErr.message}</div>
      </div>
    );
  }

  const assignments: AssignmentRow[] = Array.isArray(assignmentsData) ? assignmentsData : [];

  if (!assignments || assignments.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Decisions — Submitted Reviews</h1>
        <div className="mt-4 text-gray-600">No submitted reviews found.</div>
      </div>
    );
  }

  // Group by paper
  const byPaper = new Map<string, AssignmentRow[]>();
  const paperIds = new Set<string>();

  for (const a of assignments) {
    paperIds.add(a.paper_id);
    const arr = byPaper.get(a.paper_id) ?? [];
    arr.push(a);
    byPaper.set(a.paper_id, arr);
  }

  const paperIdList = Array.from(paperIds);

  // Fetch COIs for all papers
  const { data: coisData } = await supabaseAdmin
    .from('coi_declarations')
    .select(`
      id,
      user_id,
      paper_id,
      role,
      statement,
      declared_at,
      profiles:user_id ( id, full_name, email )
    `)
    .in('paper_id', paperIdList)
    .order('declared_at', { ascending: false });

  const cois = Array.isArray(coisData) ? coisData : [];

  const coisByPaper = new Map<string, any[]>();
  for (const c of cois) {
    const arr = coisByPaper.get(c.paper_id) ?? [];
    arr.push(c);
    coisByPaper.set(c.paper_id, arr);
  }

  const papersToRender = paperIdList.map((pid) => {
    const assignmentsForPaper = byPaper.get(pid) ?? [];
    const rawPaperJoin = assignmentsForPaper[0]?.papers;
    const paperObj = Array.isArray(rawPaperJoin) ? rawPaperJoin[0] : rawPaperJoin;

    return {
      paperId: pid,
      paper: paperObj ?? {},
      assignments: assignmentsForPaper,
      cois: coisByPaper.get(pid) ?? [],
    };
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Decisions — Papers with Submitted Reviews</h1>
        <div className="text-sm text-gray-600">{papersToRender.length} paper(s)</div>
      </div>

      <div className="space-y-4">
        {papersToRender.map((entry) => {
          const p = entry.paper;

          // Determine card color based on status
          const isPublished = p.status === 'published';
          const isRejected = p.status === 'rejected';

          let cardClass = "border rounded p-4 bg-white shadow-sm";
          if (isPublished) {
            cardClass = "border-green-200 bg-green-50 opacity-60 rounded p-4 shadow-sm";
          } else if (isRejected) {
            cardClass = "border-red-200 bg-red-50 opacity-60 rounded p-4 shadow-sm";
          }

          const disableActions = isPublished || isRejected;

          return (
            <article key={entry.paperId} className={cardClass}>
              {/* Header */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{p.title ?? 'Untitled'}</h2>
                  <div className="text-sm text-gray-600 mt-1">
                    <strong>Paper ID:</strong> {entry.paperId}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-2">
                    Status: <strong>{p.status ?? '—'}</strong>
                  </div>

                  {/* Hide buttons if published or rejected */}
                  {!disableActions && <DecisionButtons paperId={entry.paperId} />}
                </div>
              </div>

              {/* Abstract */}
              <div className="mt-3 text-sm text-gray-800">
                <div><strong>Abstract:</strong></div>
                <div className="mt-1 whitespace-pre-wrap text-gray-700">
                  {p.abstract ?? '—'}
                </div>
              </div>

              {/* Reviews + COIs */}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Reviews */}
                <div>
                  <h3 className="font-medium">Submitted reviews</h3>
                  <div className="mt-2 space-y-2">
                    {entry.assignments.map((a) => {
                      const reviewerJoin = Array.isArray(a.reviewers) ? a.reviewers[0] : a.reviewers;

                      // Normalize reviews array
                      const reviewsArr = Array.isArray(a.reviews)
                        ? a.reviews.filter(Boolean)
                        : a.reviews ? [a.reviews] : [];

                      // Pick latest review
                      let latestReview: any = null;
                      if (reviewsArr.length > 0) {
                        reviewsArr.sort((r1, r2) => new Date(r2.submitted_at).getTime() - new Date(r1.submitted_at).getTime());
                        latestReview = reviewsArr[0];
                      }

                      const recommendation = latestReview?.recommendation ?? '—';
                      const overallScore = latestReview?.overall_score ?? '—';
                      const submittedAt = latestReview?.submitted_at ?? null;

                      return (
                        <div key={a.id} className="p-2 border rounded bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm"><strong>Reviewer:</strong> {reviewerJoin?.full_name ?? reviewerJoin?.email}</div>
                              <div className="text-xs text-gray-500">
                                Assigned: {a.assigned_at ? new Date(a.assigned_at).toLocaleString() : '—'}
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm"><strong>Decision:</strong> {recommendation}</div>
                              <div className="text-sm"><strong>Score:</strong> {overallScore}</div>
                              {submittedAt && (
                                <div className="text-xs text-gray-400 mt-1">
                                  Submitted {new Date(submittedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* COIs */}
                <div>
                  <h3 className="font-medium">COI declarations</h3>
                  <div className="mt-2 space-y-2">
                    {entry.cois.length === 0 && (
                      <div className="text-gray-600">No COIs declared.</div>
                    )}

                    {entry.cois.map((c) => {
                      const who = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;

                      return (
                        <div key={c.id} className="p-2 border rounded bg-gray-50">
                          <div className="text-sm"><strong>{who?.full_name ?? who?.email}</strong></div>
                          <div className="text-xs text-gray-500">
                            Role: {c.role} · {c.declared_at ? new Date(c.declared_at).toLocaleString() : ''}
                          </div>
                          <div className="mt-1 text-sm whitespace-pre-wrap">
                            {c.statement || 'No conflict stated'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}