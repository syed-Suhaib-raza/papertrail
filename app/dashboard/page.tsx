// app/dashboard/page.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';

type Profile = { id: string; full_name?: string; role: 'author'|'reviewer'|'editor'|'admin'|'guest' };

export default function DashboardHome() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;
      if (!user) {
        if (mounted) { setLoading(false); setProfile(null); }
        return;
      }

      // fetch profile row (auth_id -> profiles.auth_id)
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .eq('auth_id', user.id)
        .single();

      if (mounted) {
        if (!error && data) setProfile(data as Profile);
        else setProfile(null);
        setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div className="p-6">Loading dashboard…</div>;
  if (!profile) return (
    <div className="p-6">
      <h2 className="text-xl font-semibold">Welcome</h2>
      <p className="text-gray-600">We couldn't find your profile — create one or check your auth session.</p>
    </div>
  );

  const role = profile.role;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-gray-600">Signed in as {profile.full_name ?? '—'} · <span className="capitalize">{role}</span></p>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Authors */}
        {(role === 'author' || role === 'admin') && (
          <Card title="Submissions" href="/dashboard/submissions" desc="Manage your submissions, revisions and view reviews." />
        )}

        {/* Reviewers */}
        {(role === 'reviewer' || role === 'admin') && (
          <Card title="Reviews" href="/dashboard/review" desc="Open assigned reviews and submit feedback." />
        )}

        {/* Editors */}
        {(role === 'editor' || role === 'admin') && (
          <Card title="Editorial" href="/dashboard/editorial" desc="Manage assignments, decisions and issues." />
        )}

        {/* Common/Utility */}
        <Card title="Notifications" href="/dashboard/notifications" desc="All system notifications." />
        <Card title="Settings" href="/dashboard/settings" desc="Profile, ORCID and account settings." />
      </section>
    </div>
  );
}

function Card({ title, desc, href }: { title: string; desc: string; href: string }) {
  return (
    <Link href={href} className="block p-5 border rounded-lg bg-white hover:shadow-md transition">
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{desc}</p>
    </Link>
  );
}