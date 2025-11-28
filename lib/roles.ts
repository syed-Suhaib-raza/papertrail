import { supabase } from "@/lib/supabaseClient";

export async function getCurrentUserProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_id", user.id)
    .single();

  return profile;
}

export async function requireRole(expectedRoles: string[]) {
  const profile = await getCurrentUserProfile();
  if (!profile) return { allowed: false, role: null };

  return {
    allowed: expectedRoles.includes(profile.role),
    role: profile.role,
  };
}