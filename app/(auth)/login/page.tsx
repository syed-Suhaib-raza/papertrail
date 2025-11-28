"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthForm from "@/components/forms/AuthForm";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saveTokenToServer(access_token: string, expires_at?: number) {
    try {
      await fetch("/api/save-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_token, expires_at }),
      });
    } catch (err) {
      console.warn("Failed to save token to server cookie:", err);
      // Not fatal for UX; middleware will block if cookie absent, but
      // we'll still navigate and let users try again.
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    console.log("Attempting login for:", email);

    try {
      const resp = await supabase.auth.signInWithPassword({ email, password });
      const { data, error: signInError } = resp as any;

      if (signInError) {
        setError(signInError.message ?? "Sign in failed");
        setLoading(false);
        return;
      }

      const user = data?.user;
      const session = data?.session;

      if (!user) {
        setError("Login did not return a user. Check auth settings.");
        setLoading(false);
        return;
      }

      // If we have a session (access token), push it to server to set HttpOnly cookie
      if (session?.access_token) {
        await saveTokenToServer(session.access_token, session.expires_at);
      }

      // Ensure profile exists (safe to call client-side)
      try {
        const { data: existing, error: existsErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("auth_id", user.id)
          .limit(1)
          .maybeSingle();

        if (existsErr) console.error("profiles select error:", existsErr);

        if (!existing) {
          const { error: insertErr } = await supabase.from("profiles").insert({
            auth_id: user.id,
            full_name: user.user_metadata?.full_name ?? null,
            email: user.email,
            role: "author",
          });

          if (insertErr) {
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

      // Finally navigate to dashboard. Use replace so login isn't in history.
      try {
        router.replace("/dashboard");
      } catch (navErr) {
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

  // If already have a client-side session (supabase stores in localStorage), redirect
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      if (data.session) router.push("/dashboard");
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <AuthForm title="Sign in to Papertrail">
      <form onSubmit={handleLogin} className="space-y-4">
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

        {error && <div className="text-red-600 text-sm">{error}</div>}

        <button type="submit" className="btn mt-4 mb-4 w-full" disabled={loading}>
          {loading ? "Signing in..." : "Login"}
        </button>

        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => router.push("/register")}
        >
          Need an account? Register
        </button>
      </form>
    </AuthForm>
  );
}