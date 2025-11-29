// app/dashboard/editorial/page.tsx
'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';

type Card = {
  title: string;
  desc: string;
  href: string;
};

export default function EditorialDashboardPage() {
  const rawCards: Card[] = [
    { title: 'Assignments', desc: 'Assign & manage reviewers', href: '/dashboard/editorial/assignments' },
    { title: 'Decisions', desc: 'Make editorial decisions (accept/reject/revise)', href: '/dashboard/editorial/decisions' },
    { title: 'Issues', desc: 'Create and manage issues / proceedings', href: '/dashboard/editorial/issues' },
    { title: 'New Issue', desc: 'Create a new issue', href: '/dashboard/editorial/issues/new' },
    { title: 'Editorial Board', desc: 'Manage editorial board members', href: '/dashboard/editorial/board' },
    { title: 'Analytics', desc: 'Reports: submissions, acceptance rates, reviewer stats', href: '/dashboard/editorial/analytics' },
    { title: 'Plagiarism Reports', desc: 'View plagiarism checks', href: '/dashboard/editorial/plagiarism' },
    { title: 'Issue Papers', desc: 'Assign papers to issues', href: '/dashboard/editorial/issues' }, // <- duplicate href intentionally or accidentally
    { title: 'Notifications', desc: 'Editor notifications', href: '/dashboard/notifications' },
    { title: 'Settings', desc: 'Editorial settings & roles', href: '/dashboard/settings' },
    { title: 'Admin Console', desc: 'Super-admin tools (if you have access)', href: '/dashboard/admin' },
  ];

  // Deduplicate by href (keeps the first occurrence). UseMemo for small perf benefit.
  const cards = useMemo(() => {
    const seen = new Set<string>();
    return rawCards.filter((c) => {
      if (seen.has(c.href)) return false;
      seen.add(c.href);
      return true;
    });
  }, [rawCards]);

  return (
    <div className="p-6">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Editorial Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Quick links for editors — assignments, decisions, issues, analytics and more.</p>
      </header>

      <main>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map((c) => (
            // stable unique key combining href + title (guarantees uniqueness even if href repeats)
            <Link key={`${c.href}::${c.title}`} href={c.href} className="block">
              <article className="h-full p-4 rounded-2xl border shadow-sm hover:shadow-md transition-shadow bg-white dark:bg-slate-800 dark:border-slate-700">
                <h2 className="text-lg font-medium">{c.title}</h2>
                <p className="text-sm text-slate-500 dark:text-slate-300 mt-2">{c.desc}</p>
                <div className="mt-4">
                  <span className="inline-block px-3 py-1 text-xs font-medium rounded-full border text-slate-700 dark:text-slate-200">
                    Open
                  </span>
                </div>
              </article>
            </Link>
          ))}
        </div>

        <section className="mt-8">
          <h3 className="text-lg font-semibold mb-2">Useful links & notes</h3>
          <ul className="list-disc pl-5 text-sm text-slate-600 dark:text-slate-300">
            <li>Use the <code>/dashboard/editorial/assignments</code> page to create review assignments and set due dates.</li>
            <li><strong>Decisions</strong> page should update <code>papers.status</code> and optionally insert into <code>editorial_decisions</code> and <code>issue_papers</code> when publishing.</li>
            <li>Guard this page so only editors/admins can access it (server or client-side role check).</li>
          </ul>
        </section>
      </main>
    </div>
  );
}