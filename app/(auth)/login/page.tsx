// app/(auth)/login/page.tsx
// Traceability: /mnt/data/23k-0621_SyedSuhaibRaza_ProjectProp.docx

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthForm from "@/components/forms/AuthForm";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  async function ensureProfile(userId: string) {
    const { data: exists } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_id", userId)
      .maybeSingle();

    if (!exists) {
      await supabase.from("profiles").insert({
        auth_id: userId,
        full_name: null,
        email,
        role: "author",
      });
    }
  }

async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  setError(null);
  setLoading(true);
  console.log("Attempting login for:", email);
  try {
    console.log("Starting sign-in process");
    // 1) Sign in
    const resp = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    const { data, error: signInError } = resp as any;
    if (signInError) {
      setError(signInError.message ?? "Sign in failed");
      setLoading(false);
      return;
    }
    console.log("Sign-in successful:", data);
    const user = data?.user;
    const session = data?.session;
    if (!user || !session) {
      setError("Login did not return an active session. Check auth settings.");
      setLoading(false);
      return;
    }
    console.log("User and session obtained:", user.id, session);
    // 2) Ensure profile exists (RLS will allow this because user is authenticated)
    try {
      const { data: existing, error: existsErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("auth_id", user.id)
        .limit(1)
        .maybeSingle();

      if (existsErr) {
        // Unexpected error checking profile - surface message but continue cautiously
        console.error("profiles select error:", existsErr);
      }
      console.log("Profile existence check:", existing);
      if (!existing) {
        const { error: insertErr } = await supabase
          .from("profiles")
          .insert({
            auth_id: user.id,
            full_name: user.user_metadata?.full_name ?? null,
            email: user.email,
            role: "author",
          });

        if (insertErr) {
          // RLS or other DB error
          setError("Profile creation failed: " + insertErr.message);
          setLoading(false);
          return;
        }
      }
    } catch (profErr) {
      console.error("ensureProfile unexpected error:", profErr);
      setError("Failed to ensure profile. See console for details.");
      setLoading(false);
      return;
    }

    // 3) Redirect to dashboard (replace so login is not in history)
    try {
        console.log("Navigating to dashboard");
        router.replace("/dashboard");
    } catch (navErr) {
      // fallback: force a browser navigation if router fails
      console.warn("router.replace failed, falling back to window.location:", navErr);
      window.location.href = "/dashboard";
    }
  } catch (err: any) {
    console.error("handleLogin unexpected error:", err);
    setError(err?.message ?? "Unexpected login error");
  } finally {
    setLoading(false);
  }
}




  // If logged in, redirect to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/dashboard");
    });
  }, [router]);

  return (
    <AuthForm title="Sign in to Papertrail">
        <div>
          <label className="block text-sm mb-1">Email</label>
          <input
            required
            type="email"
            className="input input-bordered w-full"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Password</label>
          <input
            required
            type="password"
            className="input input-bordered w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
          />
        </div>

        <button className="btn mt-4 mb-4 w-full" onClick={handleLogin}> {loading?"Signing in...":"Login"} </button>

        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => router.push("/register")}
        >
          Need an account? Register
        </button>
        </AuthForm>
  );
}
