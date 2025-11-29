// app/(public)/archive/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PublishedPaper = {
  id: string;
  title: string;
  abstract?: string | null;
  published_date?: string | null;
  current_version?: number | null;
  category_id?: number | null;
  file_path?: string | null; // from the server API (joined current version)
};

const PAGE_SIZE = 12;

export default function ArchivePage() {
  const [allPapers, setAllPapers] = useState<PublishedPaper[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // fetch once on mount
  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/published");
        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Failed to fetch published papers: ${res.status} ${text}`);
        }
        const data = (await res.json()) as PublishedPaper[];
        if (isMounted) {
          setAllPapers(Array.isArray(data) ? data : []);
          setPage(1);
        }
      } catch (err: any) {
        console.error("Error loading published papers:", err);
        if (isMounted) setError(err?.message ?? "Failed to load published papers");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  // search + filter (client-side)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return allPapers;
    return allPapers.filter((p) => {
      const t = (p.title ?? "").toLowerCase();
      const a = (p.abstract ?? "").toLowerCase();
      return t.includes(q) || a.includes(q);
    });
  }, [allPapers, query]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  // storage public base url
  const SUPABASE_PUBLIC_URL =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://uvshmzbfklarlovrxmts.supabase.co";

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-3xl font-semibold mb-4">Archive — Published Papers</h1>

      <div className="mb-6 space-y-3">
        <div>
          <input
            aria-label="Search published papers"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by title or abstract..."
            className="w-full p-3 rounded-md border focus:outline-none focus:ring"
          />
        </div>

        <div className="flex items-center justify-between text-sm text-gray-600">
          <div>
            {loading ? (
              <span>Loading papers…</span>
            ) : error ? (
              <span className="text-red-600">Error: {error}</span>
            ) : (
              <span>{filtered.length} published paper{filtered.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          <div className="space-x-2">
            <button
              onClick={() => {
                setPage(1);
                setQuery("");
              }}
              className="px-2 py-1 border rounded text-sm hover:bg-gray-50"
            >
              Reset
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
        {paginated.map((p) => {
          const publicFileUrl = p.file_path
            ? `${SUPABASE_PUBLIC_URL}/storage/v1/object/public/papers/${encodeURIComponent(
                p.file_path
              )}`
            : null;

          return (
            <article key={p.id} className="p-4 border rounded-lg shadow-sm bg-white">
              <h2 className="text-lg font-medium mb-1">
                {publicFileUrl ? (
                  <a href={publicFileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {p.title}
                  </a>
                ) : (
                  <span>{p.title}</span>
                )}
              </h2>

              <div className="text-sm text-gray-600 mb-2">
                {p.published_date ? new Date(p.published_date).toLocaleDateString() : "No date"}
                {p.current_version ? ` • v${p.current_version}` : ""}
              </div>

              <p className="text-sm text-gray-800 line-clamp-3">
                {p.abstract ?? "No abstract available."}
              </p>

              <div className="mt-3 flex items-center space-x-2">
                {publicFileUrl && (
                  <a
                    href={publicFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    View PDF
                  </a>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {/* pagination */}
      <div className="mt-6 flex items-center justify-center space-x-3">
        <button
          onClick={() => setPage((s) => Math.max(1, s - 1))}
          disabled={page === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Prev
        </button>

        <div className="text-sm">
          Page <strong>{page}</strong> / {totalPages}
        </div>

        <button
          onClick={() => setPage((s) => Math.min(totalPages, s + 1))}
          disabled={page === totalPages}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </main>
  );
}