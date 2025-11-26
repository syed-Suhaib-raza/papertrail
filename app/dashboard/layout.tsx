// app/dashboard/layout.tsx
"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function check() {
      const { data } = await supabase.auth.getSession();
      if (!isMounted) return;
      if (!data.session) {
        router.push("/(auth)/login");
      } else {
        // Optionally: ensure profile exists here as well
      }
      setLoading(false);
    }
    check();

    // Subscribe to auth changes (optional)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) router.push("/login");
    });

    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, [router]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading…</div>;
  }

  return <div>{children}</div>;
}
