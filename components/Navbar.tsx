// app/dashboard/components/Navbar.tsx
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import NotificationsNav from '@/components/NotificationsNav';

type Profile = { id: string; full_name?: string; role?: string };

export default function Navbar() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const user = userData?.user;

        if (!user) {
          if (mounted) setProfile(null);
          return;
        }

        const { data: p } = await supabase
          .from('profiles')
          .select('id, full_name, role')
          .eq('auth_id', user.id)
          .single();

        if (mounted && p) setProfile(p as Profile);
      } catch {
        if (mounted) setProfile(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) setProfile(null);
      else loadProfile();
    });

    return () => {
      mounted = false;
      try {
        // @ts-ignore
        authListener?.subscription?.unsubscribe?.();
      } catch {
        try {
          // @ts-ignore
          authListener?.unsubscribe?.();
        } catch {}
      }
    };
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <nav className="bg-white border-b">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* LEFT SECTION */}
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
                <Image src="/logo.png" alt="PaperTrail Logo" width={32} height={32} />
              <span className="font-semibold">papertrail.</span>
            </Link>

            {!loading && (
              <div className="hidden md:flex items-center gap-4">
                <Link href="/dashboard" className="text-sm hover:underline">Overview</Link>

                {profile && (profile.role === 'author' || profile.role === 'admin') && (
                  <Link href="/dashboard/submissions" className="text-sm hover:underline">Submissions</Link>
                )}

                {profile && (profile.role === 'reviewer' || profile.role === 'admin') && (
                  <Link href="/dashboard/review" className="text-sm hover:underline">Reviews</Link>
                )}

                {profile && (profile.role === 'editor' || profile.role === 'admin') && (
                  <Link href="/dashboard/editorial" className="text-sm hover:underline">Editorial</Link>
                )}
              </div>
            )}
          </div>

          {/* RIGHT SECTION */}
          <div className="flex items-center gap-4">
            {/* Notifications */}
            <NotificationsNav profileId={profile?.id ?? null} />

            {/* Settings */}
            <Link href="/dashboard/settings" className="text-sm">Settings</Link>

            {/* User Name */}
            <div className="hidden sm:block text-sm text-slate-700">
              {loading ? "…" : profile?.full_name ?? "Account"}
            </div>

            {/* LOG OUT BUTTON */}
            <button
              onClick={handleLogout}
              className="text-sm text-red-600 hover:underline ml-2"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}