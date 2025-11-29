// app/(public)/page.tsx
import React from "react";
import Link from "next/link";
import Image from "next/image"
type PaperSummary = {
  id: string;
  title: string;
  abstract?: string;
  published_date?: string | null;
  doi?: string | null;
};

async function fetchFeaturedPapers(): Promise<PaperSummary[]> {
  try {
    // expects an API route at /api/archive that returns recent published papers
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/archive`, {
      // server component by default — adjust cache if you want different behavior
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = await res.json();
    // Accept either { papers: [...] } or [...]
    return Array.isArray(json) ? json : json.papers ?? [];
  } catch (err) {
    // keep UI resilient
    return [];
  }
}

export default async function HomePage() {
  const featured = await fetchFeaturedPapers();
  const s = {src: "/logo.png", alt: "PaperTrail Logo", width: 40, height: 40};
  return (
    <main className="min-h-screen bg-gray-50 text-slate-900">
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 flex items-center justify-center">
              <Image src={s} alt="papertrail logo"/>
            </div>
            <div>
              <h1 className="text-xl font-semibold">papertrail.</h1>
            </div>
          </Link>
        </div>

        <nav className="hidden md:flex items-center gap-4 text-sm">
          <Link href="/archive" className="hover:underline">Archive</Link>
          <Link href="/about" className="hover:underline">About</Link>
          <Link href="/dashboard" className="hover:underline">Dashboard</Link>
          <Link href="/dashboard/submissions" className="hover:underline">My Submissions</Link>
          <Link href="/dashboard/review" className="hover:underline">For Reviewers</Link>
          <Link href="/dashboard/editorial" className="hover:underline">For Editors</Link>
          <Link href="/dashboard/admin" className="hover:underline">Admin</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/login" className="px-3 py-2 text-sm rounded-md border border-slate-200 hover:bg-slate-100">Log in</Link>
          <Link href="/register" className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Register</Link>
        </div>
      </header>

      <section className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-12 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
              Manage submissions, peer reviews, and publication — all in one place.
            </h2>
            <p className="mt-4 text-slate-600 max-w-xl">
              PaperTrail streamlines the academic publishing workflow: submission, reviewer assignment,
              revision cycles, editorial decisions and issue scheduling — built for journals and conferences.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/dashboard/submissions/new" className="inline-flex items-center px-5 py-3 rounded-md bg-indigo-600 text-white font-medium hover:bg-indigo-700">
                Submit a paper
              </Link>

              <Link href="/archive" className="inline-flex items-center px-4 py-3 rounded-md border border-slate-200 hover:bg-slate-50">
                Search archive
              </Link>

              <Link href="/dashboard/editorial/assignments" className="inline-flex items-center px-4 py-3 rounded-md border border-slate-200 hover:bg-slate-50">
                Assign reviewers (editor)
              </Link>
            </div>

            <div className="mt-6">
              <form action="/archive" method="get" className="flex gap-2 max-w-md">
                <label htmlFor="q" className="sr-only">Search archive</label>
                <input id="q" name="q" placeholder="Search by title, DOI, author, keywords…" className="flex-1 rounded-l-md border border-slate-200 px-4 py-2 focus:outline-none" />
                <button type="submit" className="rounded-r-md border border-slate-200 px-4 py-2 bg-slate-100">Search</button>
              </form>
            </div>
          </div>

          <div className="order-first md:order-last">
            <div className="rounded-lg border border-slate-100 p-4 bg-gradient-to-b from-white to-slate-50">
              <h3 className="text-lg font-semibold">Quick links</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li><Link href="/about" className="hover:underline">About PaperTrail</Link></li>
                <li><Link href="/archive" className="hover:underline">Browse published papers</Link></li>
                <li><Link href="/dashboard/submissions" className="hover:underline">Your submissions</Link></li>
                <li><Link href="/dashboard/review" className="hover:underline">Assigned reviews</Link></li>
                <li><Link href="/dashboard/editorial/decisions" className="hover:underline">Editor decisions</Link></li>
                <li><Link href="/dashboard/admin/users" className="hover:underline">User & roles (admin)</Link></li>
              </ul>
            </div>

            <div className="mt-4 rounded-lg border border-slate-100 p-4 bg-white">
              <h4 className="text-sm font-medium text-slate-700">Featured recent papers</h4>
              {featured.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">No recent papers to show.</p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {featured.slice(0, 5).map((p) => (
                    <li key={p.id} className="p-3 rounded-md hover:bg-slate-50">
                      <Link href={`/archive/${p.id}`} className="block">
                        <div className="text-sm font-semibold">{p.title}</div>
                        <div className="text-xs text-slate-500 truncate">{p.abstract ?? "—"}</div>
                        <div className="text-xs text-slate-400 mt-1">{p.published_date ? new Date(p.published_date).toLocaleDateString() : ""} {p.doi ? ` • ${p.doi}` : ""}</div>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border">
            <h5 className="font-semibold">For Authors</h5>
            <p className="mt-2 text-sm text-slate-600">Submit manuscripts, track revisions, view reviewer comments and decisions.</p>
            <div className="mt-4">
              <Link href="/dashboard/submissions/new" className="text-sm font-medium text-indigo-600 hover:underline">Start a submission →</Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h5 className="font-semibold">For Reviewers</h5>
            <p className="mt-2 text-sm text-slate-600">Open your assigned reviews and submit evaluations with ratings and comments.</p>
            <div className="mt-4">
              <Link href="/dashboard/review" className="text-sm font-medium text-indigo-600 hover:underline">Open review workspace →</Link>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border">
            <h5 className="font-semibold">For Editors</h5>
            <p className="mt-2 text-sm text-slate-600">Assign reviewers, make editorial decisions, and schedule issues.</p>
            <div className="mt-4 flex gap-2">
              <Link href="/dashboard/editorial/assignments" className="text-sm font-medium text-indigo-600 hover:underline">Assign reviewers</Link>
              <Link href="/dashboard/editorial/decisions" className="text-sm font-medium text-indigo-600 hover:underline">Decisions panel</Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t mt-8 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm">
          <div className="text-slate-600">© {new Date().getFullYear()} PaperTrail</div>
          <div className="flex gap-4">
            <Link href="/about" className="hover:underline">About</Link>
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}