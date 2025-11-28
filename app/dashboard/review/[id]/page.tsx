'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { logReviewerActivity } from '@/lib/reviewerAnalytics';

type DebugPayload = {
  error?: string;
  assignmentIdReceived?: string;
  userId?: string;
  byPaperMatches?: any[];
  recentForUser?: any[];
  dbError?: any;
  [k: string]: any;
};

export default function ReviewWorkspaceClient() {
  const params = useParams();
  const rawId = params?.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;
  const router = useRouter();

  const [assignment, setAssignment] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [debug, setDebug] = useState<DebugPayload | null>(null);

  // New states for decision + score
  const [decision, setDecision] = useState<'accept' | 'reject' | 'major_revision' | 'minor_revision' | ''>('');
  const [score, setScore] = useState<number | ''>('');

  // track current reviewer profile
  const [profile, setProfile] = useState<any | null>(null);

  const basePath = '/api/reviewers/assignments';

  async function fetchProfileForUserId(authUserId: string) {
    try {
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', authUserId)
        .maybeSingle();

      if (error) {
        console.error('fetchProfileForUserId error', error);
        return null;
      }
      return profileData;
    } catch (err) {
      console.error('fetchProfileForUserId exception', err);
      return null;
    }
  }

  async function updateStatus(id: string, status: string) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData?.session?.access_token;
    if (!accessToken) { alert('Not authenticated'); return; }

    const res = await fetch(`/api/reviewers/assignments/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ action: 'update_status', payload: { status } }),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error('updateStatus failed', txt);
      alert('Failed to update status');
      return;
    }

    // Log the status update as reviewer activity (RLS will ensure correct reviewer)
    try {
      if (profile?.id) {
        await logReviewerActivity({
          reviewerId: profile.id,
          assignmentId: id,
          action: `assignment_status_${status}`,
          details: { status }
        });
      }
    } catch (err) {
      console.warn('failed to log status update', err);
    }

    location.reload();
  }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setDebug(null);
      setAssignment(null);
      setProfile(null);

      if (!id) {
        setDebug({ error: 'Route param id is missing (useParams returned empty)' });
        setLoading(false);
        return;
      }

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session ?? null;
        if (!session) {
          setDebug({ error: 'No session found — user not signed in' });
          setLoading(false);
          return;
        }

        const accessToken = session.access_token;
        if (!accessToken) {
          setDebug({ error: 'No access token available in session' });
          setLoading(false);
          return;
        }

        // fetch the assignment from your server route
        const reqUrl = `${basePath}/${encodeURIComponent(id)}`;
        const res = await fetch(reqUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const json = await res.json();

        if (!mounted) return;

        if (!res.ok) {
          setDebug(json as DebugPayload);
          setAssignment(null);
        } else {
          setAssignment(json.data ?? null);

          // retrieve profile for current auth user (so we can log reviewer actions)
          const { data: userData } = await supabase.auth.getUser();
          const user = userData?.user ?? null;
          if (user) {
            const prof = await fetchProfileForUserId(user.id);
            if (mounted) setProfile(prof);

            // log a page view for analytics (only if profile exists)
            try {
              if (prof?.id) {
                await logReviewerActivity({
                  reviewerId: prof.id,
                  assignmentId: id,
                  action: 'view_assignment',
                  details: { paperId: json?.data?.paper_id ?? json?.data?.paper?.id ?? null }
                });
              }
            } catch (err) {
              console.warn('Failed to log view_assignment', err);
            }
          }
        }
      } catch (err: any) {
        console.error('Fetch assignment error', err);
        setDebug({ error: String(err) });
      } finally {
        if (mounted) setLoading(false);
      }

    })();

    return () => { mounted = false; };
  }, [id]);

  async function submitReview() {
    setSubmitting(true);
    setDebug(null);

    if (!id) {
      setDebug({ error: 'Route param id missing' });
      setSubmitting(false);
      return;
    }

    try {
      // 1) auth user
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user ?? null;
      if (userErr || !user) {
        setDebug({ error: 'Not authenticated (supabase.auth.getUser failed)', details: userErr?.message });
        alert('Not authenticated');
        setSubmitting(false);
        return;
      }

      // 2) fetch profile
      const prof = profile ?? await fetchProfileForUserId(user.id);
      if (!prof) {
        setDebug({ error: 'Profile not found for current auth user', details: 'profile missing' });
        alert('Profile not found — cannot submit review');
        setSubmitting(false);
        return;
      }

      // 3) get access token for calling server route (server validates)
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;
      const accessToken = session?.access_token;
      if (!accessToken) {
        setDebug({ error: 'No access token present' });
        alert('Not authenticated');
        setSubmitting(false);
        return;
      }

      // Client-side validations
      if (!reviewText || reviewText.trim().length < 10) {
        setDebug({ error: 'Review text too short' });
        alert('Please write at least 10 characters for the review.');
        setSubmitting(false);
        return;
      }

      if (score === '') {
        setDebug({ error: 'Score missing' });
        alert('Please give an integer score between 0 and 5.');
        setSubmitting(false);
        return;
      }

      if (!Number.isInteger(score) || score < 0 || score > 5) {
        setDebug({ error: 'Score must be an integer 0..5' });
        alert('Score must be an integer between 0 and 5.');
        setSubmitting(false);
        return;
      }

      const allowedDecisions = ['accept', 'reject', 'major_revision', 'minor_revision'];
      if (!decision || !allowedDecisions.includes(decision)) {
        setDebug({ error: 'Decision missing or invalid' });
        alert('Please select a recommendation (accept/reject/major_revision/minor_revision).');
        setSubmitting(false);
        return;
      }

      // Log 'clicked_submit' before calling the server (best-effort)
      try {
        await logReviewerActivity({
          reviewerId: prof.id,
          assignmentId: id,
          action: 'clicked_submit',
          details: { paperId: assignment?.paper_id ?? assignment?.paper?.id ?? null }
        });
      } catch (err) {
        console.warn('failed to log clicked_submit', err);
      }

      // 4) submit to API
      const reqUrl = `${basePath}/${encodeURIComponent(id)}`; // id is assignment id
      const res = await fetch(reqUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'submit_review',
          payload: {
            review_text: reviewText,
            overall_score: score,
            recommendation: decision,
            is_anonymous: false,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        setDebug(json as DebugPayload);
        alert('Failed to submit review — check debug output');
        setSubmitting(false);
        return;
      }

      // 5) log successful submission (redundant with DB trigger but useful for front-end analytics)
      try {
        await logReviewerActivity({
          reviewerId: prof.id,
          assignmentId: id,
          action: 'submitted_review',
          details: { paperId: assignment?.paper_id ?? assignment?.paper?.id ?? null, overall_score: score, recommendation: decision }
        });
      } catch (err) {
        console.warn('failed to log submitted_review', err);
      }

      // 6) ensure COI exists (same as before)
      const paperId = assignment?.paper_id;
      if (!paperId) {
        setDebug({ error: 'assignment.paper_id missing; cannot check COI' });
        alert('Submission succeeded but COI check failed (missing paper id)');
        router.push('/dashboard/review');
        setSubmitting(false);
        return;
      }

      const { data: coi, error: coiErr } = await supabase
        .from('coi_declarations')
        .select('*')
        .eq('paper_id', paperId)
        .eq('user_id', prof.id)
        .maybeSingle();

      if (coiErr) {
        setDebug({ dbError: coiErr });
        alert('Warning: could not verify COI due to DB error. Contact admin.');
        router.push('/dashboard/review');
        setSubmitting(false);
        return;
      }

      if (!coi) {
        router.push(`/dashboard/review/${id}/coi`);
        setSubmitting(false);
        return;
      }

      // mark assignment as submitted (server also attempts)
      updateStatus(id, 'submitted');

      alert('Review submitted successfully');
      router.push('/dashboard/review');
    } catch (err: any) {
      console.error('Submit review exception', err);
      setDebug({ error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-6">Loading workspace...</div>;

  if (!assignment) {
    return (
      <div className="p-6">
        <h1 className="text-xl font-semibold">Assignment</h1>
        <div className="mt-4 text-red-600">Assignment not found or you do not have access.</div>

        {debug && (
          <div className="mt-4 p-4 bg-gray-50 border rounded text-sm">
            <strong>Client debug:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(debug, null, 2)}</pre>

            <div className="mt-3">
              <em>Common causes:</em>
              <ul className="list-disc ml-5">
                <li>You passed the paper id instead of the assignment id — check server logs.</li>
                <li>Your auth user id doesn't match the assignment's <code>reviewer_id</code> — check profile/auth linkage.</li>
                <li>The assignment was deleted or never created — check your DB.</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-4">
          <button className="px-3 py-1 border rounded" onClick={() => router.push('/dashboard/review')}>Back to dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold">Review: {assignment.paper?.title ?? 'Untitled'}</h1>

      <div className="mt-4">
        {assignment.latest_version?.file_path ? (
          <a
            target="_blank"
            rel="noreferrer"
            href={`https://uvshmzbfklarlovrxmts.supabase.co/storage/v1/object/public/papers/${assignment.latest_version.file_path}`}
            className="underline"
            onClick={async () => {
              try {
                if (profile?.id) {
                  await logReviewerActivity({
                    reviewerId: profile.id,
                    assignmentId: id,
                    action: 'download_manuscript',
                    details: { file_path: assignment.latest_version.file_path, paperId: assignment.paper_id ?? assignment.paper?.id ?? null }
                  });
                }
              } catch (err) {
                console.warn('failed to log download_manuscript', err);
              }
            }}
          >
            Download manuscript (latest)
          </a>
        ) : (
          <div className="text-sm text-gray-600">No manuscript file available.</div>
        )}
      </div>

      <div className="mt-4">
        <label className="block text-sm font-medium">Your review</label>
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          rows={12}
          className="w-full border rounded p-2"
          placeholder="Write your review..."
        />
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium">Recommendation</label>
          <select
            value={decision}
            onChange={(e) => setDecision(e.target.value as any)}
            className="w-full border rounded p-2"
          >
            <option value="">Select recommendation...</option>
            <option value="accept">Accept</option>
            <option value="minor_revision">Minor revision</option>
            <option value="major_revision">Major revision</option>
            <option value="reject">Reject</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium">Score (0–5)</label>
          <input
            type="number"
            min={0}
            max={5}
            step={1}
            value={score === '' ? '' : String(score)}
            onChange={(e) => {
              const val = e.target.value;
              if (val === '') return setScore('');
              const n = Number(val);
              if (!Number.isFinite(n)) return;
              setScore(Math.trunc(n));
            }}
            className="w-full border rounded p-2"
            placeholder="e.g. 4"
          />
          <div className="text-xs text-gray-500 mt-1">Integer score used for overall_score in DB.</div>
        </div>

        <div>
          <label className="block text-sm font-medium">Anonymity</label>
          <div className="mt-2">
            <label className="inline-flex items-center">
              <input
                type="checkbox"
                checked={false}
                readOnly
                className="mr-2"
              />
              Reviews are currently non-anonymous (toggle not implemented).
            </label>
            <div className="text-xs text-gray-500 mt-1">If you want anonymous reviews, we can add a toggle; currently submissions send <code>is_anonymous: false</code>.</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={submitReview}
          disabled={submitting}
          className="px-4 py-2 bg-green-600 text-white rounded"
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>

        <button
          onClick={() => router.push('/dashboard/review')}
          className="px-4 py-2 border rounded"
        >
          Cancel
        </button>
      </div>

      <div className="mt-6 text-sm text-gray-600">
        <strong>Assignment meta:</strong>
        <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(assignment, null, 2)}</pre>
      </div>

      {debug && (
        <div className="mt-6 p-4 bg-gray-50 border rounded text-sm">
          <strong>Client debug:</strong>
          <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(debug, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}