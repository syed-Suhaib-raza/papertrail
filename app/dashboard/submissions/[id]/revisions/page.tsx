'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient'; // adjust if your client export differs

type PaperVersion = {
  id: string;
  paper_id: string;
  version_number: number;
  file_path: string | null;
  file_mime: string | null;
  metadata: Record<string, any> | null;
  created_by: string | null;
  created_at: string | null;
  notes: string | null;
};

function isUuid(v?: string | null) {
  if (!v) return false;
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(
    v
  );
}

export default function RevisionsPageClient() {
  const params = useParams();
  const router = useRouter();

  // normalize param: sometimes it's string[] — take first element
  const rawId = params?.id;
  const paperId: string | null = Array.isArray(rawId) ? rawId[0] ?? null : rawId ?? null;

  const [versions, setVersions] = useState<PaperVersion[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // early guards
    if (!paperId) {
      setError('Missing submission id in URL.');
      setLoading(false);
      return;
    }
    if (!isUuid(paperId)) {
      setError(`Invalid submission id format: ${String(paperId)}`);
      setLoading(false);
      return;
    }

    // simple client-side fetch (no AbortController)
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperId]);

  async function loadVersions() {
    if (!paperId) {
      setError('Missing submission id.');
      setVersions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: sbErr } = await supabase
        .from('paper_versions')
        .select(
          `id,
           paper_id,
           version_number,
           file_path,
           file_mime,
           metadata,
           created_by,
           created_at,
           notes`
        )
        .eq('paper_id', paperId)
        .order('version_number', { ascending: false });

      if (sbErr) {
        // Typically RLS/permission issue or other DB error; surface a helpful message
        console.error('Supabase error fetching versions:', sbErr);
        setError(sbErr.message ?? 'Failed to fetch versions from the database.');
        setVersions([]);
      } else {
        setVersions((data as PaperVersion[]) || []);
      }
    } catch (ex: any) {
      console.error('Unexpected error loading versions:', ex);
      setError(String(ex?.message ?? ex));
      setVersions([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Revisions</h1>
          <p className="text-sm text-muted-foreground">
            Submission ID: <code>{paperId ?? '—'}</code>
          </p>
        </div>

        <div className="flex gap-2">
          <button
            className="btn"
            onClick={() => {
              loadVersions();
            }}
            aria-label="Refresh versions"
          >
            Refresh
          </button>

          <button
            className="btn btn-primary"
            onClick={() => {
              if (!paperId) return;
              router.push(`/dashboard/submissions/${encodeURIComponent(paperId)}/edit`);
            }}
          >
            Edit submission
          </button>
        </div>
      </div>

      {error && <div className="p-3 bg-red-100 text-red-800 rounded">{error}</div>}

      <h2 className="text-lg font-medium">All Versions</h2>

      {loading ? (
        <div>Loading versions...</div>
      ) : versions.length === 0 ? (
        <div className="p-3 bg-yellow-50 rounded">No versions found for this submission.</div>
      ) : (
        <ul className="space-y-4">
          {versions.map((v) => (
            <li key={v.id} className="p-4 border rounded">
              <div className="flex justify-between items-start gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Version #{v.version_number}</div>
                  <div className="font-medium">{v.metadata?.title ?? '(No title)'}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Created:{' '}
                    {v.created_at ? new Date(v.created_at).toLocaleString() : 'unknown'} by{' '}
                    {v.created_by ?? 'unknown'}
                  </div>

                  {v.notes && <p className="mt-2 text-sm whitespace-pre-wrap">{v.notes}</p>}

                  {v.file_path && (
                    <div className="mt-2">
                      <a target="_blank" rel="noreferrer" href={`https://uvshmzbfklarlovrxmts.supabase.co/storage/v1/object/public/papers/${v.file_path}`} className="underline text-sm">Open</a>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  <div>id: <code>{v.id}</code></div>
                  <div className="mt-2">{v.file_mime ?? ''}</div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}