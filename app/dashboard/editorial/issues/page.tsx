'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Issue = Record<string, any>;

export default function IssuesListPage() {
  const router = useRouter();
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchIssues();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchIssues() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/issues');
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        // if not JSON, show text
        console.warn('/api/issues returned non-json:', text);
        data = [];
      }

      console.debug('GET /api/issues response:', { status: res.status, body: data });

      if (!res.ok) {
        throw new Error((data && data.message) || `Failed to load issues (${res.status})`);
      }

      setIssues(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('fetchIssues error', err);
      setError(err.message || 'Failed to fetch issues');
    } finally {
      setLoading(false);
    }
  }

  // normalize volume & issue fields with fallbacks
  function volumeOf(issue: Issue) {
    return issue.volume ?? issue.volume_number ?? issue.vol ?? '—';
  }
  function issueNumberOf(issue: Issue) {
    return issue.issue_number ?? issue.issue_no ?? issue.number ?? '—';
  }

  async function handlePublish(issueId: string, title?: string) {
    if (!issueId) return;
    const confirmMsg = `Publish issue${title ? `: "${title}"` : ''}? This will set the issue's published column to true.`;
    if (!window.confirm(confirmMsg)) return;

    setPublishingId(issueId);
    setError(null);

    try {
      const res = await fetch(`/api/issues/${issueId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const payload = await res.json().catch(() => ({}));
      console.debug('POST publish response', { status: res.status, body: payload });

      if (!res.ok) {
        throw new Error(payload?.message || `Publish failed (${res.status})`);
      }

      // update local list
      setIssues(prev => prev.map(i => (i.id === issueId ? { ...i, ...payload } : i)));
    } catch (err: any) {
      console.error('publish error', err);
      setError(err.message || 'Failed to publish issue');
      alert(err.message || 'Failed to publish issue');
    } finally {
      setPublishingId(null);
    }
  }

  function handleEdit(issueId: string) {
    router.push(`/dashboard/editorial/issues/${issueId}`);
  }

  return (
    <div className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Issues</h1>
        <div>
          <button
            className="px-3 py-1 bg-slate-800 text-white rounded"
            onClick={() => router.push('/dashboard/editorial/issues/new')}
          >
            New Issue
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading issues…</p>
      ) : error ? (
        <div className="text-red-600 mb-4">{error}</div>
      ) : issues.length === 0 ? (
        <p className="text-sm text-slate-500">No issues found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full table-auto border-collapse">
            <thead>
              <tr className="text-left">
                <th className="py-2 px-3">Title</th>
                <th className="py-2 px-3">Volume</th>
                <th className="py-2 px-3">Issue</th>
                <th className="py-2 px-3">Scheduled</th>
                <th className="py-2 px-3">Published</th>
                <th className="py-2 px-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.map(issue => (
                <tr key={issue.id} className="border-t">
                  <td className="py-3 px-3 align-top">
                    <div className="font-medium">{issue.title}</div>
                    <div className="text-xs text-slate-500">{issue.slug ?? ''}</div>
                  </td>
                  <td className="py-3 px-3 align-top">{volumeOf(issue)}</td>
                  <td className="py-3 px-3 align-top">{issueNumberOf(issue)}</td>
                  <td className="py-3 px-3 align-top">
                    {issue.scheduled_release_date ? new Date(issue.scheduled_release_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 px-3 align-top">
                    {issue.published ? (
                      <span className="inline-block px-2 py-1 text-xs rounded bg-green-100 text-green-800">Published</span>
                    ) : (
                      <span className="inline-block px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">Unpublished</span>
                    )}
                  </td>
                  <td className="py-3 px-3 align-top">
                    <div className="flex gap-2">
                      <button
                        className="px-2 py-1 rounded border"
                        onClick={() => handleEdit(issue.id)}
                      >
                        Edit
                      </button>

                      <button
                        className="px-2 py-1 rounded bg-slate-800 text-white"
                        disabled={issue.published || publishingId === issue.id}
                        onClick={() => handlePublish(issue.id, issue.title)}
                      >
                        {publishingId === issue.id ? 'Publishing…' : issue.published ? 'Published' : 'Publish'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}