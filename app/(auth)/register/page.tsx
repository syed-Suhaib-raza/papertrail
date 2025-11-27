"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import AuthForm from "@/components/forms/AuthForm";

export default function RegisterPage() {
  const router = useRouter();

  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole]         = useState("author");
  const [cat, setCat]           = useState(0);

  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function createProfileIfMissing(userId: string) {
    const { data: exists } = await supabase
      .from("profiles")
      .select("id")
      .eq("auth_id", userId)
      .maybeSingle();
    console.log(cat)
    if (!exists) {
      const { error: pErr } = await supabase.from("profiles").insert({
        auth_id: userId,
        full_name: fullName,
        email,
        role,
        spec:cat,
      });

      if (pErr) throw new Error(pErr.message);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    const user = data.user;
    if (!user) {
      setError("Registration succeeded, but the session was not created.");
      setLoading(false);
      return;
    }

    try {
      await createProfileIfMissing(user.id);
      router.push("/dashboard");
    } catch (err: any) {
      setError("Failed to create profile: " + err.message);
    }

    setLoading(false);
  }

  return (
    <AuthForm title="Create an account">
      <form onSubmit={handleRegister} className="space-y-4">

        <div>
          <label className="block text-sm mb-1">Full Name</label>
          <input
            required
            className="input input-bordered w-full"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
          />
        </div>

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
            placeholder="Choose a password"
          />
        </div>

        <div>
          <label className="block text-sm mb-1">Role</label>
          <select
            className="select select-bordered w-full"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          >
            <option value="author">Author</option>
            <option value="reviewer">Reviewer</option>
            <option value="editor">Editor</option>
          </select>
        </div>
        {(role === 'reviewer') && (
          <div>
          <label className="block text-sm mb-1">Specialty</label>
          <select
            className="select select-bordered w-full"
            value={cat}
            onChange={(e) => {
              const val = e.target.value;
              setCat(Number(val));
              console.log(cat);
            }}
          >
            <option value=''>Select Specialty</option>
            <option value='1'>Aritificial Intelligence</option>
            <option value='2'>Mathematics</option>
            <option value='3'>Computer Networks</option>
          </select>
        </div>
        )}

        {error && (
          <div className="text-red-600 text-sm">
            {error}
          </div>
        )}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "Creating account…" : "Register"}
        </button>

        <button
          type="button"
          className="btn btn-ghost w-full"
          onClick={() => router.push("/login")}
        >
          Already have an account? Log in
        </button>
      </form>
    </AuthForm>
  );
}