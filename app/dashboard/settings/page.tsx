"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";

type Profile = {
  id: string;
  full_name: string;
  email?: string;
  affiliation?: string;
  orcid?: string;
  role?: string;
  updated_at?: string;
};

export default function DashboardSettingsPage() {
  const router = useRouter();
const [profile, setProfile] = useState<Partial<Profile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function loadProfile() {
      setLoading(true);
      try {
        const { data: userData, error: userErr } = await supabase.auth.getUser();
        if (userErr) throw userErr;
        const user = userData.user;
        if (!user) {
          // Not logged in — redirect to login
          router.push("/login");
          return;
        }

        // Query profiles table for the row with auth_id = user.id
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, affiliation, orcid, role, updated_at, created_at")
          .eq("auth_id", user.id)
          .limit(1)
          .single();

        if (error && error.code !== "PGRST116") throw error; // let PGRST116 (no rows) be handled

        if (mounted) setProfile(data || { email: user.email });
      } catch (err: any) {
        console.error("Failed to load profile:", err.message || err);
        toast.error("Could not load profile");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [router]);

  function change(field: string, value: any) {
    setProfile((p) => ({ ...(p || {}), [field]: value }));
  }

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      // If profile.id exists — update, otherwise insert
      if (profile.id) {
        const { error } = await supabase
          .from("profiles")
          .update({
            full_name: profile.full_name,
            affiliation: profile.affiliation,
            orcid: profile.orcid,
          })
          .eq("id", profile.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("profiles").insert([
          {
            auth_id: (await supabase.auth.getUser()).data.user?.id,
            full_name: profile.full_name || null,
            affiliation: profile.affiliation || null,
            orcid: profile.orcid || null,
            role: profile.role || "author",
            email: profile.email || null,
          },
        ]);
        if (error) throw error;
          }
      toast.success("Profile saved");
    } catch (err: any) {
      console.error("Save profile failed:", err.message || err);
      toast.error("Failed to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <div>Loading profile…</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Profile Settings</h1>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => router.push("/dashboard")}>Back</Button>
          <Button onClick={handleLogout} variant="destructive">Log out</Button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Personal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4">
              <div>
                <Label>Full name</Label>
                <Input
                  value={profile?.full_name || ""}
                  onChange={(e) => change("full_name", e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              <div>
                <Label>Email (read-only)</Label>
                <Input value={profile?.email || ""} readOnly />
              </div>

              <div>
                <Label>Affiliation</Label>
                <Input
                  value={profile?.affiliation || ""}
                  onChange={(e) => change("affiliation", e.target.value)}
                  placeholder="University, company, institute"
                />
              </div>

              <div>
                <Label>ORCID</Label>
                <Input
                  value={profile?.orcid || ""}
                  onChange={(e) => change("orcid", e.target.value)}
                  placeholder="0000-0000-0000-0000"
                />
                <p className="text-sm text-muted-foreground mt-1">Optional — used for automated metadata.</p>
              </div>

              <div>
                <Label>Role</Label>
                <Input value={profile?.role || "author"} readOnly />
                <p className="text-sm text-muted-foreground mt-1">Your role determines access (author / reviewer / editor / admin).</p>
              </div>

              <div className="flex gap-2 mt-4">
                <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
                <Button variant="outline" onClick={() => window.location.reload()}>Reset</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      <div className="mt-6">
        <Card>
          <CardHeader>
            <CardTitle>Danger zone</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-sm">If you need to delete your account, contact the site administrator. (Deletion is handled server-side.)</p>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => toast("Contact admin to delete account")}>Request account deletion</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}