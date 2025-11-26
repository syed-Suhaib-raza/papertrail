'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function EditSubmissionPage() {
  const router = useRouter();
  const params = useParams() as { id?: string };
  const paperId = params.id as string;

  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [versions, setVersions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!paperId) return;
    let mounted = true;

    async function load() {
      try {
        const { data: paper, error: paperErr } = await supabase
          .from('papers')
          .select('title, abstract')
          .eq('id', paperId)
          .single();

        if (paperErr) {
          console.error('load paper error', paperErr);
          setErrorMsg('Failed to load paper');
        } else if (paper && mounted) {
          setTitle(paper.title ?? '');
          setAbstract(paper.abstract ?? '');
        }

        // load versions (schema has file_path, file_mime, created_at, notes, version_number).
        const { data: vers, error: versErr } = await supabase
          .from('paper_versions')
          .select('id, version_number, file_path, file_mime, created_at, notes')
          .eq('paper_id', paperId)
          .order('version_number', { ascending: false });

        if (versErr) {
          console.error('load versions error', versErr);
          setErrorMsg('Failed to load versions');
        } else if (mounted) {
          setVersions(vers ?? []);
        }
      } catch (err) {
        console.error('load edit', err);
        setErrorMsg('Failed to load data');
      }
    }

    load();
    return () => { mounted = false; };
  }, [paperId]);

  async function uploadNewVersion() {
    setErrorMsg(null);
    if (!file) {
      setErrorMsg('No file selected');
      return;
    }
    setLoading(true);

    try {
      // get user + token (same approach as your working new-submission page)
      const { data: userData } = await supabase.auth.getUser();
      const session = (await supabase.auth.getSession()).data?.session;
      const token = session?.access_token;
      if (!userData?.user || !token) {
        setErrorMsg('Not authenticated — please log in');
        router.push('/login');
        return;
      }

      const filename = `${crypto.randomUUID()}-${file.name}`;
      const path = `${userData.user.id}/papers/${filename}`;

      const upload = await supabase.storage.from('papers').upload(path, file, { cacheControl: '3600', upsert: false });
      if (upload.error) {
        console.error('Supabase upload.error', upload.error);
        const errMsg = upload.error?.message || JSON.stringify(upload.error);
        setErrorMsg(`Failed to upload file: ${errMsg}`);
        setLoading(false);
        return;
      }

      console.log('DEBUG: calling versions API for paperId=', paperId);
      // register the version on server via POST; send the token in Authorization header
      const res = await fetch(`/api/papers/${paperId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          storage_path: path,
          file_mime: file.type,
          notes: null
        })
      });

      console.log('version route status', res.status, res.statusText);
      let body = null;
      try { body = await res.json(); console.log('version route body', body); } catch (e) {}

      if (!res.ok) {
        const errMsg = body?.message || body?.detail || JSON.stringify(body) || 'Version registration failed';
        throw new Error(errMsg);
      }

      // server returns { ok: true, version: verInsert }
      const newVersion = body?.version ?? body;
      setVersions((v) => [newVersion, ...v]);
      setFile(null);
    } catch (err: any) {
      console.error('upload version error', err);
      setErrorMsg(err?.message || 'Failed to upload version');
    } finally {
      setLoading(false);
    }
  }

  async function saveMetadata() {
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('papers')
        .update({ title, abstract })
        .eq('id', paperId);
      if (error) {
        console.error('save meta error', error);
        setErrorMsg('Failed to save metadata');
      } else {
        router.refresh();
      }
    } catch (err) {
      console.error('save meta', err);
      setErrorMsg('Failed to save metadata');
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Edit Submission</h1>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded-md border p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium">Abstract</label>
          <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={6} className="mt-1 block w-full rounded-md border p-2" />
        </div>

        <div className="flex gap-2">
          <button onClick={saveMetadata} className="px-4 py-2 rounded-lg border">Save</button>
          <button onClick={() => router.push('/dashboard/submissions')} className="px-4 py-2 rounded-lg border">Back</button>
        </div>
      </div>

      <hr className="my-6" />

      <h2 className="text-xl font-semibold mb-2">Version History</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Upload new version (PDF)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1" />
          {errorMsg && <div className="text-red-600 mt-2">{errorMsg}</div>}
          <div className="mt-2 flex gap-2">
            <button onClick={uploadNewVersion} disabled={loading} className="px-4 py-2 rounded-lg border">{loading ? 'Uploading...' : 'Upload new version'}</button>
            <button onClick={() => setFile(null)} className="px-4 py-2 rounded-lg border">Cancel</button>
          </div>
        </div>

        <div>
          {versions.length === 0 ? (
            <div className="text-sm text-gray-600">No versions yet.</div>
          ) : (
            <ul className="space-y-2">
              {versions.map((v: any) => {
                const fileName = (v.file_path ?? '').split('/').pop();
                const publicUrl = v?.file_path ? supabase.storage.from('papers').getPublicUrl(v.file_path).data?.publicUrl : null;
                return (
                  <li key={v.id} className="p-3 border rounded-lg flex justify-between items-center">
                    <div>
                      <div className="text-sm font-medium">Version {v.version_number} — {fileName}</div>
                      <div className="text-xs text-gray-500">Uploaded: {v.created_at ? new Date(v.created_at).toLocaleString() : '—'}</div>
                      {v.notes && <div className="text-sm text-gray-600 mt-1">Notes: {v.notes}</div>}
                    </div>
                    <div className="flex gap-2">
                      <a target="_blank" rel="noreferrer" href={publicUrl ?? '#'} className="underline text-sm">Open</a>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}