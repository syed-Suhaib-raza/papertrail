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
  console.log("DEBUG: handleLogin invoked — immediate log"); // <- should appear
  try {
    // tiny delay to show UI stays responsive
    await new Promise((res) => setTimeout(res, 200));
    console.log("DEBUG: after delay — no supabase call");
  } catch(e) {
    console.error("DEBUG: unexpected error in basic handler", e);
  }
}



  // If logged in, redirect to dashboard
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.push("/dashboard");
    });
  }, [router]);

  return (
    <AuthForm title="Sign in to PaperTrail">
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

        {error && (
          <div className="text-red-600 text-sm">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Signing in…" : "Login"}
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
