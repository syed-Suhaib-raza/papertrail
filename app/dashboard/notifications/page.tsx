'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import NotificationsPage from '@/components/NotificationsPage';

export default function NotificationsRoutePage() {
  // states for resolving profile id
  const [profileId, setProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function resolveProfile() {
      setLoading(true);
      setErrorMsg(null);

      try {
        // 1) get current auth user
        const authRes = await supabase.auth.getUser();
        const user = (authRes as any).data?.user ?? null;
        if (!user) {
          setErrorMsg('Not signed in — no auth user available.');
          setProfileId(null);
          setLoading(false);
          return;
        }

        // 2) look up profile.id in your profiles table by auth_id (common pattern)
        // adjust column name if your project uses a different mapping (e.g., auth_uid -> auth_id)
        const profileRes = await supabase
          .from('profiles')
          .select('id')
          .eq('auth_id', user.id)
          .maybeSingle();

        // Supabase response shapes vary slightly by version/typing; handle safely:
        const profileData = (profileRes as any).data ?? null;
        const profileError = (profileRes as any).error ?? null;

        if (profileError) {
          console.error('error fetching profile row', profileError);
          setErrorMsg(String(profileError.message ?? profileError));
          setProfileId(null);
        } else if (!profileData) {
          console.warn('no profile row found for auth user', user.id);
          setErrorMsg('No profile row found for current user. Ensure profiles.auth_id matches auth user id.');
          setProfileId(null);
        } else {
          if (mounted) {
            setProfileId(profileData.id);
          }
        }
      } catch (err) {
        console.error('unexpected error resolving profile', err);
        setErrorMsg(String(err));
        setProfileId(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    resolveProfile();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <div className="p-6">Resolving profile…</div>;
  if (errorMsg) return <div className="p-6 text-red-600">Error: {errorMsg}</div>;
  if (!profileId) return <div className="p-6 text-slate-600">No profile found (check profiles.auth_id mapping).</div>;

  return (
    <div>
      {/* pass the profileId into your existing NotificationsPage component */}
      <NotificationsPage profileId={profileId} />
    </div>
  );
}