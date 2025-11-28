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

  const [assignment, setAssignment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reviewText, setReviewText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [debug, setDebug] = useState<DebugPayload | null>(null);

  const basePath = '/api/reviewers/assignments';

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
        // Get session (robust extraction in case of differences in supabase versions)
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken =
          // supabase v2 returns session under sessionData.session; older helpers may differ
          sessionData?.session?.access_token;

        if (!accessToken) {
          setDebug({ error: 'No session / not signed in' });
          setLoading(false);
          return;
        }

        const reqUrl = `${basePath}/${encodeURIComponent(id)}`;
        console.log('Fetching assignment from', reqUrl);

        const res = await fetch(reqUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const json = await res.json();
        console.log('assignment fetch response:', json);

        if (!mounted) return;

        if (!res.ok) {
          setDebug(json as DebugPayload);
          setAssignment(null);
        } else {
          setAssignment(json.data ?? null);
          console.log('Loaded assignment:', json.data);
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
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) { alert('Not authenticated'); setSubmitting(false); return; }

      const reqUrl = `${basePath}/${encodeURIComponent(id)}`;
      const res = await fetch(reqUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({
          action: 'submit_review',
          payload: { review_text: reviewText, overall_score: null, recommendation: null, is_anonymous: false }
        }),
      });

      const json = await res.json();
      console.log('submit review response', json);

      if (!res.ok) {
        setDebug(json);
        alert('Failed to submit review — check debug below');
        setSubmitting(false);
        return;
      }

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
            <strong>Server debug:</strong>
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: 8 }}>{JSON.stringify(debug, null, 2)}</pre>

            <div className="mt-3">
              <em>Common causes:</em>
              <ul className="list-disc ml-5">
                <li>You passed the paper id instead of the assignment id — check <code>byPaperMatches</code>.</li>
                <li>Your auth user id doesn't match the assignment's <code>reviewer_id</code> — check <code>recentForUser</code>.</li>
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
        <a target="_blank" rel="noreferrer" href={`https://uvshmzbfklarlovrxmts.supabase.co/storage/v1/object/public/papers/${assignment.latest_version.file_path}`} className="underline">
          Download manuscript (latest)
        </a>
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