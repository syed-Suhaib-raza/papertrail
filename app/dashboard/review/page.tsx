// app/dashboard/review/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Assignment = any;

export default function ReviewDashboardPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all'|'assigned'|'in_progress'|'submitted'|'late'|'declined'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      const res = await fetch('/api/reviewers/assignments', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!mounted) return;
      if (!res.ok) {
        console.error('Failed to fetch assignments', await res.text());
        setAssignments([]);
      } else {
        const json = await res.json();
        setAssignments(json.data || []);
      }
      setLoading(false);
    })();

    return () => { mounted = false; };
  }, []);

  const filtered = assignments.filter((a: any) => {
    if (filter !== 'all' && a.status !== filter) return false;
    if (search && a.paper && !a.paper.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Reviewer Dashboard</h1>

        <div className="flex gap-3">
          <input
            className="border px-3 py-1 rounded"
            placeholder="Search by paper title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="border px-3 py-1 rounded">
            <option value="all">All</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In Progress</option>
            <option value="submitted">Submitted</option>
            <option value="late">Late</option>
            <option value="declined">Declined</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div>Loading assignments...</div>
      ) : filtered.length === 0 ? (
        <div className="text-muted">No assignments found.</div>
      ) : (
        <div className="grid gap-4">
          {filtered.map((a: any, index: number) => (
  <div
    key={a.id ?? `${a.paper_id}-${index}`}
    className="border rounded p-4 shadow-sm flex justify-between"
  >
    <div>
      <h2 className="text-lg font-medium">{a.paper?.title ?? "Untitled paper"}</h2>
      <p className="text-sm text-slate-600 mt-1 truncate" style={{ maxWidth: 700 }}>
        {a.paper?.abstract}
      </p>
      <div className="text-xs mt-2 text-slate-500">
        <span>
          Due: {a.due_date ? new Date(a.due_date).toLocaleString() : "No due date"}
        </span>
        {" • "}
        <span>Status: {a.status}</span>
        {" • "}
        <span>Priority: {a.priority}</span>
        {a.expertise_match_score ? ` • Score: ${a.expertise_match_score}` : null}
      </div>
    </div>

    <div className="flex flex-col items-end gap-2">
      <Link
        href={`/dashboard/review/${a.id}`}
        className="px-3 py-1 rounded bg-indigo-600 text-white text-sm"
      >
        Open review
      </Link>

      <div className="flex gap-2">
        <button
          onClick={() => updateStatus(a.id, "in_progress")}
          className="px-2 py-1 border rounded text-sm"
        >
          Start
        </button>
        <button
          onClick={() => updateStatus(a.id, "declined")}
          className="px-2 py-1 border rounded text-sm"
        >
          Decline
        </button>
      </div>
    </div>
  </div>
))}

        </div>
      )}
    </div>
  );
}