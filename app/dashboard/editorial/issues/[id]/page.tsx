'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Paper = { id: string; title: string; status: string; created_by?: string };

export default function IssueDetails({ params }: { params: any }) {
  // params may be a Promise or an object. Resolve it safely.
  const [issueId, setIssueId] = useState<string | null>(null);

  const [issue, setIssue] = useState<any>(null);
  const [papers, setPapers] = useState<Paper[]>([]);
  const [selectedPaper, setSelectedPaper] = useState<string | null>(null);
  const [issuePapers, setIssuePapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // resolve params (handles both plain object and Promise)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const resolved = await params; // if params is not a Promise, this immediately resolves
        if (!mounted) return;
        const id = resolved?.id ?? null;
        if (typeof id === 'string') setIssueId(id);
      } catch (err) {
        // swallow - leave issueId null
        console.error('Failed to resolve params', err);
      }
    })();
    return () => {
      mounted = false;
    };
    // only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // fetch data once we have issueId
  useEffect(() => {
    if (!issueId) return;
    fetchIssue();
    fetchCandidatePapers();
    fetchIssuePapers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issueId]);

  async function fetchIssue() {
    if (!issueId) return;
    const res = await fetch(`/api/issues/${issueId}`);
    if (res.ok) setIssue(await res.json());
  }

  async function fetchCandidatePapers() {
  if (!issueId || typeof issueId !== 'string') return;
  try {
    const res = await fetch(`/api/issues/${issueId}/candidates`);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error('candidates error', body);
      setPapers([]); // or show an error UI
      return;
    }
    const data = await res.json();
    setPapers(Array.isArray(data) ? data : []);
  } catch (err) {
    console.error('fetchCandidatePapers error', err);
    setPapers([]);
  }
}


  async function fetchIssuePapers() {
    if (!issueId) return;
    const res = await fetch(`/api/issues/${issueId}/papers`);
    if (res.ok) setIssuePapers(await res.json());
  }

  async function handleAddPaper(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPaper || !issueId) return;
    setLoading(true);
    const res = await fetch(`/api/issues/${issueId}/add-paper`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paper_id: selectedPaper }),
    });
    setLoading(false);

    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Failed' }));
      alert(err.message || 'Failed to add paper');
      return;
    }
    // refresh list
    fetchIssuePapers();
    fetchCandidatePapers();
    setSelectedPaper(null);
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-2">{issue?.title || (issueId ? 'Issue' : 'Loading...')}</h1>
      <p className="text-sm text-slate-600 mb-4">
        {console.log('Issue data:', issue)}
        Volume: {issue?.volume} • Issue: {issue?.issue_number ?? '—'}
      </p>

      <section className="mb-6">
        <h2 className="font-medium">Add paper to issue</h2>
        <form onSubmit={handleAddPaper} className="flex items-center gap-2 mt-2">
          <select
            value={selectedPaper ?? ''}
            onChange={e => setSelectedPaper(e.target.value)}
            className="border p-2"
            disabled={!papers.length}
          >
            <option value="">Select a paper</option>
            {papers.map(p => (
              <option key={p.id} value={p.id}>
                {p.title} — {p.status}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedPaper || loading}
            type="submit"
            className="px-3 py-1 bg-slate-800 text-white rounded"
          >
            {loading ? 'Adding…' : 'Add'}
          </button>
        </form>
        {!issueId && <p className="text-sm text-slate-500 mt-2">Resolving issue id…</p>}
      </section>

      <section>
        <h2 className="font-medium mb-2">Papers in this issue</h2>
        <ol className="list-decimal ml-6 space-y-2">
          {issuePapers.map(p => (
            <li key={p.id} className="flex justify-between">
              <span>{p.title}</span>
              <span className="text-sm text-slate-500">{p.status}</span>
            </li>
          ))}
          {issuePapers.length === 0 && <p className="text-sm text-slate-500">No papers yet.</p>}
        </ol>
      </section>
    </div>
  );
}