// app/dashboard/review/[id]/page.tsx  (client)
'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

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

  const basePath = '/api/reviewers/assignments';
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
      // Simple refresh; you can replace with optimistic UI update
      location.reload();
    }

  useEffect(() => {
    let mounted = true;

    (async () => {
      setLoading(true);
      setDebug(null);
      setAssignment(null);

      if (!id) {
        setDebug({ error: 'Route param id is missing (useParams returned empty)' });
        setLoading(false);
        return;
      }

      try {
        // Get session & user (supabase v2)
        const { data: sessionData } = await supabase.auth.getSession();
        const session = sessionData?.session ?? null;
        if (!session) {
          setDebug({ error: 'No session found — user not signed in' });
          setLoading(false);
          return;
        }

        // access token string to authenticate the fetch call's Authorization header
        const accessToken = session.access_token;
        if (!accessToken) {
          setDebug({ error: 'No access token available in session' });
          setLoading(false);
          return;
        }

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
      // 1) get auth user from supabase client
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      const user = userData?.user ?? null;
      if (userErr || !user) {
        setDebug({ error: 'Not authenticated (supabase.auth.getUser failed)', details: userErr?.message });
        alert('Not authenticated');
        setSubmitting(false);
        return;
      }

      // 2) fetch profile row (profiles.auth_id -> auth.users.id)
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (profileErr || !profile) {
        setDebug({ error: 'Profile not found for current auth user', details: profileErr?.message });
        alert('Profile not found — cannot submit review');
        setSubmitting(false);
        return;
      }

      // 3) Submit review to API (use the stored session token)
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session ?? null;
      const accessToken = session?.access_token;
      if (!accessToken) {
        setDebug({ error: 'No access token present' });
        alert('Not authenticated');
        setSubmitting(false);
        return;
      }

      const reqUrl = `${basePath}/${encodeURIComponent(id)}`; // id is assignment id
      const res = await fetch(reqUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'submit_review',
          payload: {
            review_text: reviewText,
            overall_score: null,
            recommendation: null,
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

      // 4) Ensure COI exists for this user & paper before allowing review flow to continue.
      //    Use profile.id (not JWT) to query coi_declarations (RLS expects user_id = profile.id).
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
        .eq('user_id', profile.id)
        .maybeSingle();

      if (coiErr) {
        // DB-level error fetching COI
        setDebug({ dbError: coiErr });
        alert('Warning: could not verify COI due to DB error. Contact admin.');
        router.push('/dashboard/review');
        setSubmitting(false);
        return;
      }

      if (!coi) {
        // No COI declared — redirect reviewer to COI page
        router.push(`/dashboard/review/${id}/coi`);
        setSubmitting(false);
        return;
      }
      updateStatus(id, 'submitted');
      // All good
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
          >
            Download manuscript (latest)
          </a>
        ) : (
          <div className="text-sm text-gray-600">No manuscript file available.</div>
        )}
      </div>

      <div className="mt-4">
        <textarea
          value={reviewText}
          onChange={(e) => setReviewText(e.target.value)}
          rows={12}
          className="w-full border rounded p-2"
          placeholder="Write your review..."
        />
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
    </div>
  );
}