'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Reviewer = {
  id: string;
  full_name: string;
  spec: Number;
};

type Paper = {
  id: string;
  title: string;
  status?: string;
  category_id: Number;
};

export default function AssignReviewerToPaper() {
  const { paperId } = useParams();
  const router = useRouter();

  const [paper, setPaper] = useState<Paper | null>(null);
  const [reviewers, setReviewers] = useState<Reviewer[]>([]);
  const [reviewerId, setReviewerId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high'>('normal');
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!paperId) return;
    const init = async () => {
      setLoading(true);

      const {
        data: { user },
        error: userErr
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        setUnauthorized(true);
        router.replace('/login');
        return;
      }

      // verify role
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('auth_id', user.id)
        .single();

      if (profErr || !profile) {
        console.error('profile fetch failed', profErr);
        setUnauthorized(true);
        router.replace('/');
        return;
      }

      if (!(profile.role === 'editor' || profile.role === 'admin')) {
        setUnauthorized(true);
        router.replace('/dashboard');
        return;
      }

      // load paper
      const { data: paperData, error: paperErr } = await supabase
        .from('papers')
        .select('id, title, status,category_id')
        .eq('id', paperId)
        .single();

      if (paperErr) {
        console.error('paper fetch error', paperErr);
        setPaper(null);
      } else {
        setPaper(paperData as Paper);
      }

      // load reviewers
      const { data: reviewerData, error: revErr } = await supabase
        .from('profiles')
        .select('id, full_name,spec')
        .eq('role', 'reviewer');

      if (revErr) {
        console.error('reviewers fetch error', revErr);
        setReviewers([]);
      } else {
        for (let i=0; i<reviewerData?.length || -1;i++){
            if (reviewerData[i].spec !== paperData?.category_id) {
                reviewerData?.splice(i,1);
            }
        }
        setReviewers((reviewerData as Reviewer[]) || []);
      }

      setLoading(false);
    };

    init();
  }, [paperId, router]);

  const submit = async () => {
    if (!reviewerId) return alert('Select a reviewer');

    setSubmitting(true);

    try {
      const res = await fetch('/api/assign-reviewer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperId,
          reviewerId,
          dueDate: dueDate || null,
          priority
        })
      });

      const json = await res.json();
      if (!res.ok) {
        alert('Error assigning reviewer: ' + (json.error || res.statusText));
      } else {
        alert('Reviewer assigned');
        router.push('/dashboard/editorial/assignments');
      }
    } catch (err: any) {
      console.error(err);
      alert('Failed to assign reviewer: ' + (err?.message ?? String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="p-6">Loading...</p>;
  if (unauthorized) return <p className="p-6">Unauthorized — redirecting...</p>;
  if (!paper) return <p className="p-6">Paper not found.</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-bold">Assign Reviewer — {paper.title}</h1>

      <div>
        <label className="block text-sm">Select Reviewer</label>
        <select
          className="border p-2 rounded w-full"
          value={reviewerId}
          onChange={(e) => setReviewerId(e.target.value)}
        >
          <option value="">Select Reviewer</option>
          {reviewers.map((r) => (
            <option key={r.id} value={r.id}>
              {r.full_name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm">Due Date</label>
        <input
          type="date"
          className="border p-2 rounded w-full"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
        />
      </div>

      <div>
        <label className="block text-sm">Priority</label>
        <select
          className="border p-2 rounded w-full"
          value={priority}
          onChange={(e) => setPriority(e.target.value as 'low' | 'normal' | 'high')}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
      </div>

      <button
        onClick={submit}
        disabled={submitting}
        className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50"
      >
        {submitting ? 'Assigning...' : 'Assign Reviewer'}
      </button>
    </div>
  );
}