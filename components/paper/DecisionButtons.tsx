// components/editor/DecisionButtons.tsx
'use client';
import React, { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';

export default function DecisionButtons({ paperId }: { paperId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<'idle'|'approve'|'reject'>('idle');

  async function postAction(action: 'approve'|'reject') {
    setLoading(action);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      if (!token) {
        alert('You are not signed in.');
        setLoading('idle');
        return;
      }

      const res = await fetch('/api/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ paperId, action }),
      });

      const json = await res.json();
      if (!res.ok) {
        console.error('Decision failed', json);
        alert('Decision failed: ' + (json?.error ?? 'unknown'));
        setLoading('idle');
        return;
      }

      alert(`Action succeeded: ${json.action ?? json}`);
      // refresh the page to show updated status (or optimistically update)
      router.refresh();
    } catch (err) {
      console.error(err);
      alert('Unexpected error');
    } finally {
      setLoading('idle');
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={() => postAction('approve')}
        disabled={loading !== 'idle'}
        className="px-3 py-1 bg-green-600 text-white rounded"
      >
        {loading === 'approve' ? 'Approving...' : 'Approve'}
      </button>

      <button
        onClick={() => {
          if (!confirm('Reject this paper? This will set its status to rejected.')) return;
          postAction('reject');
        }}
        disabled={loading !== 'idle'}
        className="px-3 py-1 bg-red-600 text-white rounded"
      >
        {loading === 'reject' ? 'Rejecting...' : 'Reject'}
      </button>
    </div>
  );
}