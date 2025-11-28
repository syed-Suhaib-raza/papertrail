'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

type Paper = {
  id: string;
  title: string;
  abstract: string | null;
  status: string;
  created_at: string;
  current_version?: number | null;
};

export default function SubmissionsPageClient() {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;
    async function load() {
      console.log("DEBUG:")
      const { data } = await supabase.auth.getUser();
      console.log(data?.user?.id);

      setLoading(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;
        if (!user) {
          router.push('/login');
          return;
        }

        const { data, error } = await supabase
          .from('papers')
          .select('id, title, abstract, status, created_at, current_version')
          .order('created_at', { ascending: false });

        if (error) throw error;
        if (mounted) setPapers((data as any) || []);
      } catch (err) {
        console.error('Load papers error', err);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    
    return () => { mounted = false; };
  }, [router]);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">My Submissions</h1>
        <button
          className="px-4 py-2 rounded-lg shadow-sm border hover:bg-gray-50"
          onClick={() => router.push('/dashboard/submissions/new')}
        >
          + New Submission
        </button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : papers.length === 0 ? (
        <div className="text-muted">You have not submitted any papers yet.</div>
      ) : (
        <div className="space-y-4">
          {papers.map((p) => (
            <div key={p.id} className="p-4 border rounded-lg flex justify-between">
              <div>
                <div className="text-lg font-medium">{p.title}</div>
                <div className="text-sm text-gray-600 mt-1 truncate max-w-2xl">{p.abstract}</div>
                <div className="text-xs text-gray-500 mt-2">Submitted: {new Date(p.created_at).toLocaleString()}</div>
              </div>
              <div className="flex flex-col items-end">
                <div className="px-3 py-1 rounded-full text-sm border">{p.status}</div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => router.push(`/dashboard/submissions/${p.id}/reviews`)} className="text-sm underline">Reviews</button>
                  <button onClick={() => router.push(`/dashboard/submissions/${p.id}/edit`)} className="text-sm underline">Edit</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
