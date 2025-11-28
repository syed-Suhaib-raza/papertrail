'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import { useParams } from 'next/navigation';

type Profile = { id: string; auth_id?: string; full_name?: string; email?: string };
type Paper = { id: string; title?: string | null; abstract?: string | null; status?: string | null; created_at?: string | null; created_by?: string | null };
type ReviewRow = {
  id: string;
  paper_id: string;
  assignment_id?: string | null;
  reviewer_id?: string | null;
  review_text?: string | null;
  overall_score?: number | string | null;
  recommendation?: string | null;
  is_anonymous?: boolean | null;
  submitted_at?: string | null;
  reviewer_profile?: Profile | null;
  assignment?: { id?: string; assigned_at?: string | null } | null;
};

export default function AuthorReviewsPage() {
  const params = useParams();
  const maybePaperId = Array.isArray(params?.id) ? params?.id[0] : (params?.id ?? null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [rawPaperRows, setRawPaperRows] = useState<any[]>([]);
  const [reviewsByPaper, setReviewsByPaper] = useState<Map<string, ReviewRow[]>>(new Map());

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        // 1) get logged-in user
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        const user = userData?.user ?? null;
        if (userErr || !user) {
          throw new Error('Not signed in');
        }

        // 2) fetch profile row (profiles.auth_id -> auth.users.id)
        const { data: profileRow, error: profileErr } = await supabase
          .from('profiles')
          .select('id, auth_id, full_name, email')
          .eq('auth_id', user.id)
          .maybeSingle();

        if (profileErr) throw profileErr;
        if (!profileRow) throw new Error('Profile not found');

        if (!mounted) return;
        setProfile(profileRow);

        // 3) fetch papers.
        // If a paperId is present in the URL, fetch that paper explicitly (authors often open a paper-specific reviews page).
        // Otherwise, fetch papers created by either profiles.id OR auth.user.id (covers both schema variants).
        let paperRows: any[] = [];
        if (maybePaperId) {
          const { data: single, error: singleErr } = await supabase
            .from('papers')
            .select('id, title, abstract, status, created_at, created_by')
            .eq('id', maybePaperId)
            .limit(1)
            .maybeSingle();

          if (singleErr) throw singleErr;
          if (single) paperRows = [single];
          else paperRows = [];
        } else {
          const createdByProfileId = profileRow.id;
          const createdByAuthId = user.id;

          const { data: many, error: manyErr } = await supabase
            .from('papers')
            .select('id, title, abstract, status, created_at, created_by')
            .or(`created_by.eq.${createdByProfileId},created_by.eq.${createdByAuthId}`)
            .order('created_at', { ascending: false });

          if (manyErr) throw manyErr;
          paperRows = Array.isArray(many) ? many : [];
        }

        if (!mounted) return;
        setRawPaperRows(paperRows);

        const myPapers: Paper[] = paperRows.map((r: any) => ({
          id: String(r.id),
          title: r.title ?? null,
          abstract: r.abstract ?? null,
          status: r.status ?? null,
          created_at: r.created_at ?? null,
          created_by: r.created_by ?? null,
        }));

        setPapers(myPapers);

        if (!myPapers.length) {
          // no papers: nothing more to fetch — but preserve debug info for troubleshooting
          setReviewsByPaper(new Map());
          return;
        }

        const paperIds = myPapers.map((p) => p.id);

        // 4) fetch reviews for these papers.
        // Join reviewer profile and assignments (assignment meta) if available.
        const { data: reviewsData, error: reviewsErr } = await supabase
          .from('reviews')
          .select(`
            id,
            paper_id,
            assignment_id,
            reviewer_id,
            review_text,
            overall_score,
            recommendation,
            is_anonymous,
            submitted_at,
            reviewer_profile:reviewer_id ( id, full_name, email ),
            assignment:assignment_id ( id, assigned_at )
          `)
          .in('paper_id', paperIds)
          .order('submitted_at', { ascending: false });

        if (reviewsErr) throw reviewsErr;

        // Normalize reviewsData (handle joined arrays)
        const reviewsRaw: any[] = Array.isArray(reviewsData) ? reviewsData : [];

        const reviewsArr: ReviewRow[] = reviewsRaw.map((r: any) => {
          const reviewer_profile = (() => {
            if (!r.reviewer_profile) return null;
            if (Array.isArray(r.reviewer_profile)) return r.reviewer_profile[0] ?? null;
            return r.reviewer_profile;
          })();

          const assignment = (() => {
            if (!r.assignment) return null;
            if (Array.isArray(r.assignment)) return r.assignment[0] ?? null;
            return r.assignment;
          })();

          return {
            id: r.id,
            paper_id: r.paper_id,
            assignment_id: r.assignment_id,
            reviewer_id: r.reviewer_id,
            review_text: r.review_text,
            overall_score: r.overall_score,
            recommendation: r.recommendation,
            is_anonymous: r.is_anonymous,
            submitted_at: r.submitted_at,
            reviewer_profile,
            assignment,
          } as ReviewRow;
        });

        // 5) group reviews by paper_id
        const map = new Map<string, ReviewRow[]>();
        for (const r of reviewsArr) {
          const arr = map.get(r.paper_id) ?? [];
          arr.push(r);
          map.set(r.paper_id, arr);
        }

        if (!mounted) return;
        setReviewsByPaper(map);
      } catch (err: any) {
        console.error('AuthorReviewsPage error', err);
        if (!mounted) return;
        setError(err?.message ?? String(err));
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [maybePaperId]);

  if (loading) {
    return <div className="p-6">Loading your reviews…</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Your paper reviews</h1>
        <div className="mt-4 text-red-600">Error: {error}</div>
      </div>
    );
  }

  // Helpful debug when no papers found
  if (papers.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold">Reviews on your submissions</h1>
        <div className="mt-4 p-4 bg-yellow-50 border rounded">
          <strong>No papers found for your account.</strong>
          <div className="mt-2 text-sm text-gray-700">
            This can happen when the <code>papers.created_by</code> column uses a different ID than your profile ID.
          </div>

          <div className="mt-3 text-sm">
            <div><strong>Debug info</strong></div>
            <ul className="mt-2 list-disc ml-5 text-xs text-gray-700">
              <li>auth.user.id: <code>{profile ? '[protected]' : 'unknown'}</code> (hidden in UI)</li>
              <li>profile.id: <code>{profile?.id ?? '—'}</code></li>
              <li>requested paper id (from URL): <code>{maybePaperId ?? '—'}</code></li>
              <li>raw papers returned from DB: <pre className="mt-2 p-2 bg-white border rounded text-xs">{JSON.stringify(rawPaperRows, null, 2)}</pre></li>
            </ul>
          </div>

          <div className="mt-3">
            <div className="text-sm text-gray-600">If you expect a specific paper to appear, open it directly using the paper's submission page link (or confirm the <code>created_by</code> value in the DB).</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Reviews on your submissions</h1>
        <div className="text-sm text-gray-600">{papers.length} paper(s)</div>
      </div>

      <div className="space-y-4">
        {papers.map((p) => {
          const reviews = reviewsByPaper.get(p.id) ?? [];

          return (
            <article key={p.id} className="border rounded p-4 bg-white shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold">{p.title ?? 'Untitled'}</h2>
                  <div className="text-sm text-gray-600 mt-1">
                    <strong>Paper ID:</strong> {p.id} · <strong>Status:</strong> {p.status ?? '—'}
                  </div>
                </div>

                <div className="text-right">
                  <Link href={`/dashboard/submissions/${p.id}`} className="text-sm underline">View submission</Link>
                  <div className="text-xs text-gray-500 mt-1">Submitted: {p.created_at ? new Date(p.created_at).toLocaleString() : '—'}</div>
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-800">
                <div><strong>Abstract:</strong></div>
                <div className="mt-1 whitespace-pre-wrap text-gray-700">{p.abstract ?? '—'}</div>
              </div>

              <div className="mt-4">
                <h3 className="font-medium">Reviews ({reviews.length})</h3>

                {reviews.length === 0 && (
                  <div className="mt-2 text-gray-600">No reviews have been submitted for this paper yet.</div>
                )}

                <div className="mt-2 space-y-3">
                  {reviews.map((r) => {
                    const reviewerName =
                      r.is_anonymous ? 'Anonymous' : (r.reviewer_profile?.full_name ?? r.reviewer_profile?.email ?? r.reviewer_id ?? 'Reviewer');

                    const submittedAt = r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—';
                    const recommendation = r.recommendation ?? '—';
                    const score = r.overall_score !== null && r.overall_score !== undefined ? String(r.overall_score) : '—';

                    return (
                      <div key={r.id} className="p-3 border rounded bg-gray-50">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="text-sm font-medium">{reviewerName}</div>
                            <div className="text-xs text-gray-500">Assignment: {r.assignment_id ?? '—'} · Submitted: {submittedAt}</div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm"><strong>Recommendation:</strong> {recommendation}</div>
                            <div className="text-sm"><strong>Score:</strong> {score}</div>
                          </div>
                        </div>

                        {r.review_text && (
                          <div className="mt-2 text-sm text-gray-700">
                            <strong>Review:</strong>
                            <div className="mt-1 whitespace-pre-wrap">{r.review_text}</div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}