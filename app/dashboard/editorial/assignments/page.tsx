'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type PaperListItem = {
  id: string;
  title: string;
  status: string;
};

export default function ReviewerAssignmentsPage() {
  const router = useRouter();
  const [papers, setPapers] = useState<PaperListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  useEffect(() => {
    const init = async () => {
      setLoading(true);

      // 1) Get current user
      const {
        data: { user },
        error: userErr
      } = await supabase.auth.getUser();

      if (userErr || !user) {
        // not signed in -> send to login
        setUnauthorized(true);
        router.replace('/login');
        return;
      }

      // 2) Fetch profile to check role
      const { data: profile, error: profErr } = await supabase
        .from('profiles')
        .select('id, role')
        .eq('auth_id', user.id)
        .single();

      if (profErr || !profile) {
        console.error('profile fetch failed', profErr);
        setUnauthorized(true);
        router.replace('/dashboard'); // or a better "no access" page
        return;
      }

      if (!(profile.role === 'editor' || profile.role === 'admin')) {
        setUnauthorized(true);
        // Option: show message for 1s then redirect
        router.replace('/dashboard');
        return;
      }

      // 3) Load papers needing assignment
      const { data, error } = await supabase
        .from('papers')
        .select('id, title, status')
        .in('status', ['submitted', 'under_review']);

      if (error) {
        console.error('fetch papers error', error);
        setPapers([]);
      } else {
        setPapers((data as PaperListItem[]) || []);
      }

      setLoading(false);
    };

    init();
  }, [router]);

  if (loading) return <p className="p-6">Loading...</p>;
  if (unauthorized) return <p className="p-6">Unauthorized — redirecting...</p>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Assign Reviewers</h1>

      {papers.length === 0 ? (
        <p>No papers need reviewer assignments right now.</p>
      ) : (
        <ul className="space-y-3">
          {papers.map((p) => (
            <li key={p.id} className="p-4 border rounded shadow-sm flex justify-between items-center">
              <div>
                <h2 className="font-semibold">{p.title}</h2>
                <p className="text-sm text-gray-500">Status: {p.status}</p>
              </div>

              <Link
                href={`/dashboard/editorial/assignments/${p.id}`}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                Assign
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}