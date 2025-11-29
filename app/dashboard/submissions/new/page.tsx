'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function NewPaperPageClient() {
  const [title, setTitle] = useState('');
  const [abstract, setAbstract] = useState('');
  const [keywords, setKeywords] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // NEW
  const [citations, setCitations] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);

    if (!title.trim()) return setErrorMsg('Title is required');
    if (!file) return setErrorMsg('PDF file is required');

    setLoading(true);

    try {
      // Get user + token
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      const session = (await supabase.auth.getSession()).data?.session;
      const accessToken = session?.access_token;

      if (!user || !accessToken) {
        setErrorMsg("User not logged in");
        router.push('/login');
        return;
      }

      // Upload PDF
      let storagePath: string | null = null;

      if (file) {
        const filename = `${crypto.randomUUID()}-${file.name}`;
        const path = `${user.id}/papers/${filename}`;

        const upload = await supabase.storage
          .from('papers')
          .upload(path, file, { cacheControl: '3600', upsert: false });

        if (upload.error) {
          setErrorMsg(`Failed to upload file: ${upload.error.message}`);
          setLoading(false);
          return;
        }

        storagePath = path;
      }

      // Parse citations
      const citationsArray = citations
        .split('\n')
        .map((ln) => ln.trim())
        .filter(Boolean)
        .map((ln) => {
          const parts = ln.split('||').map((p) => p.trim());
          return {
            cited_text: parts[0],
            cited_doi: parts[1] || null,
          };
        });

      // Submit to API
      const res = await fetch('/api/submit-paper', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          title: title.trim(),
          abstract: abstract || null,
          keywords: keywords || null,
          category_id: categoryId || null,
          storage_path: storagePath,
          citations: citationsArray
        })
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body?.message || 'Submission failed');
      }

      router.push('/dashboard/submissions');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to submit');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Submit New Paper</h1>

      <form onSubmit={handleSubmit} className="space-y-4">

        {/* TITLE */}
        <div>
          <label className="block text-sm font-medium">Title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 block w-full rounded-md border p-2"
          />
        </div>

        {/* ABSTRACT */}
        <div>
          <label className="block text-sm font-medium">Abstract</label>
          <textarea
            value={abstract}
            onChange={(e) => setAbstract(e.target.value)}
            rows={6}
            className="mt-1 block w-full rounded-md border p-2"
          />
        </div>

        {/* KEYWORDS + CATEGORY */}
        <div className="grid grid-cols-2 gap-4">

          <div>
            <label className="block text-sm font-medium">Keywords</label>
            <input
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              className="mt-1 block w-full rounded-md border p-2"
            />
          </div>

          <div>
            <label className="block text-sm mb-1">Specialty</label>
            <select
              className="select select-bordered w-full"
              value={categoryId ?? ''}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              <option value="">Select category</option>
              <option value="1">Artificial Intelligence</option>
              <option value="2">Mathematics</option>
              <option value="3">Computer Networks</option>
            </select>
          </div>

        </div>

        {/* PDF UPLOAD */}
        <div>
          <label className="block text-sm font-medium">Manuscript (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1"
          />
        </div>

        {/* CITATIONS (NEW) */}
        <div>
          <label className="block text-sm font-medium">Citations (one per line)</label>
          <div className="text-xs text-gray-500 mb-1">
            Format:  
            <br />
            <code>Author (Year). Title || DOI</code>
          </div>
          <textarea
            value={citations}
            onChange={(e) => setCitations(e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border p-2"
            placeholder={`Smith J. (2020). Research on X || 10.1234/abcd\nDoe A. (2019). Another Citation`}
          />
        </div>

        {/* ERRORS */}
        {errorMsg && (
          <div className="text-red-600">{errorMsg}</div>
        )}

        {/* BUTTONS */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 rounded-lg border"
          >
            {loading ? 'Submitting...' : 'Submit'}
          </button>

          <button
            type="button"
            onClick={() => router.push('/dashboard/submissions')}
            className="px-4 py-2 rounded-lg border"
          >
            Cancel
          </button>
        </div>

      </form>
    </div>
  );
}