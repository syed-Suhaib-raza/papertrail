'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function NewIssuePage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [volume, setVolume] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [scheduledReleaseDate, setScheduledReleaseDate] = useState('');
  const [published, setPublished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // derive a simple slug
    const slug = title.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // call server endpoint
    const res = await fetch('/api/issues', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        slug,
        volume,
        issue_number: issueNumber,
        scheduled_release_date: scheduledReleaseDate || null,
        published,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Server error' }));
      setError(err.message || 'Failed to create issue');
      return;
    }

    const payload = await res.json();
    // navigate to issue details
    router.push(`/dashboard/editorial/issues/${payload.id}`);
  }

  return (
    <div className="max-w-2xl p-6">
      <h1 className="text-2xl font-semibold mb-4">Create New Issue</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input required value={title} onChange={e => setTitle(e.target.value)} className="mt-1 block w-full" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Volume</label>
            <input value={volume} onChange={e => setVolume(e.target.value)} className="mt-1 block w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium">Issue Number</label>
            <input value={issueNumber} onChange={e => setIssueNumber(e.target.value)} className="mt-1 block w-full" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Scheduled release date</label>
          <input type="date" value={scheduledReleaseDate} onChange={e => setScheduledReleaseDate(e.target.value)} className="mt-1 block" />
        </div>

        <div className="flex items-center space-x-2">
          <input id="published" type="checkbox" checked={published} onChange={e => setPublished(e.target.checked)} />
          <label htmlFor="published" className="text-sm">Mark as published</label>
        </div>

        {error && <p className="text-red-600">{error}</p>}

        <div>
          <button disabled={loading} type="submit" className="px-4 py-2 rounded bg-slate-800 text-white">
            {loading ? 'Creating…' : 'Create Issue'}
          </button>
        </div>
      </form>
    </div>
  );
}