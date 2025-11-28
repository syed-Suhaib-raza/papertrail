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
  papers?: any; // joined paper object/array
  reviewers?: any; // joined reviewer object/array
  reviews?: any; // joined reviews array or object
};

export default async function DecisionsIndexPage() {
  // 1) fetch assignments with status = 'submitted' and join paper + reviewer + review info
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

  const assignments: AssignmentRow[] = Array.isArray(assignmentsData) ? assignmentsData as AssignmentRow[] : [];

  if (!assignments || assignments.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Decisions — Submitted Reviews</h1>
        <div className="mt-4 text-gray-600">No submitted reviews found.</div>
      </div>
    );
  }

  // group assignments by paper_id and collect unique paper IDs
  const byPaper = new Map<string, AssignmentRow[]>();
  const paperIds = new Set<string>();
  for (const a of assignments) {
    paperIds.add(a.paper_id);
    const arr = byPaper.get(a.paper_id) ?? [];
    arr.push(a);
    byPaper.set(a.paper_id, arr);
  }

  const paperIdList = Array.from(paperIds);

  // fetch COI declarations for all these papers in one query
  const { data: coisData, error: coisErr } = await supabaseAdmin
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

  const cois: any[] = Array.isArray(coisData) ? coisData : [];

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
    const coisForPaper = coisByPaper.get(pid) ?? [];
    return {
      paperId: pid,
      paper: paperObj ?? { id: pid, title: 'Untitled', abstract: null, status: null, created_at: null },
      assignments: assignmentsForPaper,
      cois: coisForPaper,
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
          return (
            <article key={entry.paperId} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{p.title ?? 'Untitled'}</h2>
                  <div className="text-sm text-gray-600 mt-1">
                    <strong>Paper ID:</strong> {entry.paperId}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm text-gray-600 mb-2">Status: <strong>{p.status ?? '—'}</strong></div>
                  <DecisionButtons paperId={entry.paperId} />
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-800">
                <div><strong>Abstract:</strong></div>
                <div className="mt-1 whitespace-pre-wrap text-gray-700">{p.abstract ?? '—'}</div>
              </div>

              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h3 className="font-medium">Submitted reviews (assignments)</h3>
                  <div className="mt-2 space-y-2">
                    {entry.assignments.map((a: AssignmentRow) => {
                      const reviewerJoin = Array.isArray(a.reviewers) ? a.reviewers[0] : a.reviewers;

                      // Normalise reviews into an array (handles object or array)
                      const reviewsArr: any[] = (() => {
                        if (!a.reviews) return [];
                        if (Array.isArray(a.reviews)) return a.reviews.filter(Boolean);
                        return [a.reviews];
                      })();

                      // pick the most recent review by submitted_at (desc)
                      let latestReview: any | null = null;
                      if (reviewsArr.length) {
                        reviewsArr.sort((r1, r2) => {
                          const t1 = r1?.submitted_at ? new Date(r1.submitted_at).getTime() : 0;
                          const t2 = r2?.submitted_at ? new Date(r2.submitted_at).getTime() : 0;
                          return t2 - t1;
                        });
                        latestReview = reviewsArr[0];
                      }

                      const recommendation = latestReview?.recommendation ?? '—';
                      const overallScore = latestReview?.overall_score ?? null;
                      const submittedAt = latestReview?.submitted_at ?? null;

                      return (
                        <div key={a.id} className="p-2 border rounded bg-gray-50">
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="text-sm"><strong>Reviewer:</strong> {reviewerJoin?.full_name ?? reviewerJoin?.email ?? a.reviewer_id}</div>
                              <div className="text-xs text-gray-500">Assigned at: {a.assigned_at ? new Date(a.assigned_at).toLocaleString() : '—'}</div>
                              <div className="text-xs text-gray-500">Assignment id: {a.id}</div>
                            </div>

                            <div className="text-right">
                              <div className="text-sm"><strong>Decision:</strong> {String(recommendation)}</div>
                              <div className="text-sm"><strong>Score:</strong> {overallScore !== null && overallScore !== undefined ? String(overallScore) : '—'}</div>
                              <div className="text-xs text-gray-400 mt-1">{submittedAt ? `Submitted ${new Date(submittedAt).toLocaleString()}` : ''}</div>
                            </div>
                          </div>

                          {latestReview?.review_text && (
                            <div className="mt-2 text-sm text-gray-700">
                              <strong>Excerpt:</strong>
                              <div className="mt-1 line-clamp-3">{latestReview.review_text}</div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <h3 className="font-medium">COI declarations for this paper</h3>
                  <div className="mt-2 space-y-2">
                    {entry.cois.length === 0 && <div className="text-gray-600">No COIs declared.</div>}
                    {entry.cois.map((c: any) => {
                      const who = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
                      return (
                        <div key={c.id} className="p-2 border rounded bg-gray-50">
                          <div className="text-sm"><strong>{who?.full_name ?? who?.email ?? c.user_id}</strong></div>
                          <div className="text-xs text-gray-500">Role: {c.role} · Declared: {c.declared_at ? new Date(c.declared_at).toLocaleString() : '—'}</div>
                          <div className="mt-1 text-sm whitespace-pre-wrap">{c.statement || 'No conflict stated'}</div>
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