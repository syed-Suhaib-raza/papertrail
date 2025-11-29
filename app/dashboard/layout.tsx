// app/dashboard/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/Navbar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      try {
        const { data } = await supabase.auth.getSession();
        if (!isMounted) return;

        if (!data?.session) {
          // send user to auth flow
          router.push("/(auth)/login");
        } else {
          // optionally: you could verify profile existence here if you want
          // const user = data.session.user;
          // fetch profiles where auth_id = user.id ...
        }
      } catch (err) {
        // if anything goes wrong, send to login
        router.push("/(auth)/login");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    check();

    // subscribe to auth state changes so we can redirect on sign-out
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        router.push("/(auth)/login");
      }
    });

    return () => {
      isMounted = false;
      // defensive unsubscribe: different supabase client versions expose unsubscribe differently
      try {
        // v2-style: authListener.subscription.unsubscribe()
        // @ts-ignore
        authListener?.subscription?.unsubscribe?.();
      } catch {
        try {
          // fallback: authListener.unsubscribe()
          // @ts-ignore
          authListener?.unsubscribe?.();
        } catch {
          // ignore
        }
      }
    };
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto p-6">
        {children}
      </main>
    </div>
  );
}