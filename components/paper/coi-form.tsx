// components/paper/coi-form.tsx  (client component)
'use client';

import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function COIForm({ paperId, role }: { paperId: string; role: string }) {
  const router = useRouter();
  const [statement, setStatement] = useState('');
  const [loading, setLoading] = useState(false);

  async function submitCOI() {
    try {
      setLoading(true);

      // get session and access token from client-side supabase
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        alert('Not authenticated (no access token)');
        setLoading(false);
        return;
      }

      // get auth user
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        alert('Not authenticated (no user)');
        setLoading(false);
        return;
      }

      // get profile id for this auth user
      const { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('auth_id', user.id)
        .maybeSingle();

      if (profileErr || !profile?.id) {
        console.error('Profile lookup failed', profileErr);
        alert('Profile not found');
        setLoading(false);
        return;
      }

      // POST to server API (server will use service key)
      const res = await fetch('/api/coi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paperId,
          role,              // use the prop passed in (was hardcoded to 'author' before)
          statement,
          userId: profile.id // service-key API expects this
        })
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('COI save failed', json);
        alert('COI save failed: ' + (json?.error ?? 'unknown'));
        setLoading(false);
        return;
      }

      alert('COI saved');
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Unexpected error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <textarea
        className="w-full border rounded p-2"
        placeholder="If no conflict, write 'No conflict' or leave blank"
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        rows={5}
      />
      <div>
        <button disabled={loading} onClick={submitCOI} className="px-4 py-2 bg-blue-600 text-white rounded">
          {loading ? 'Saving…' : 'Save COI'}
        </button>
      </div>
    </div>
  );
}