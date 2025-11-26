'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {supabase} from '@/lib/supabaseClient';

export default function NewPaperPageClient() {
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!title.trim()) return setErrorMsg('Title is required');

    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      const session = (await supabase.auth.getSession()).data?.session;
      const accessToken = session?.access_token;

      if (!user || !accessToken) {
        router.push('/auth/login');
        return;
      }

      // If there's a file, upload it first from client to Storage using the authenticated user's session.
      let storagePath: string | null = null;
      if (file) {
        const filename = `${crypto.randomUUID()}-${file.name}`;
        const path = `${user.id}/papers/${filename}`;
        const upload = await supabase.storage.from('papers').upload(path, file, { cacheControl: '3600', upsert: false });
        if (upload.error) {
          console.error('Upload error', upload.error);
          setErrorMsg('Failed to upload file');
          setLoading(false);
          return;
        }
        storagePath = path; // pass to API so server can record it in paper_versions / paper_files
      }

      // Call our server API (which will run DB queries as the user) to create the paper row
      const res = await fetch('/api/submit-paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}` // pass user's token to server route
        },
        body: JSON.stringify({ title: title.trim(), abstract: abstract || null, keywords: keywords || null, category_id: categoryId || null, storage_path: storagePath })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Server failed');
      }

      router.push('/dashboard/submissions');
    } catch (err: any) {
      console.error('submit error', err);
      setErrorMsg(err.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Submit New Paper</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium">Title <span className="text-red-500">*</span></label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 block w-full rounded-md border p-2" />
        </div>

        <div>
          <label className="block text-sm font-medium">Abstract</label>
          <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} rows={6} className="mt-1 block w-full rounded-md border p-2" />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium">Keywords (comma separated)</label>
            <input value={keywords} onChange={(e) => setKeywords(e.target.value)} className="mt-1 block w-full rounded-md border p-2" />
          </div>
          <div>
            <label className="block text-sm font-medium">Category</label>
            <input value={categoryId ?? ''} onChange={(e) => setCategoryId(e.target.value || null)} className="mt-1 block w-full rounded-md border p-2" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium">Manuscript (PDF)</label>
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1" />
        </div>

        {errorMsg && <div className="text-red-600">{errorMsg}</div>}

        <div className="flex gap-2">
          <button type="submit" disabled={loading} className="px-4 py-2 rounded-lg border">{loading ? 'Submitting...' : 'Submit'}</button>
          <button type="button" onClick={() => router.push('/dashboard/submissions')} className="px-4 py-2 rounded-lg border">Cancel</button>
        </div>
      </form>
    </div>
  );
}