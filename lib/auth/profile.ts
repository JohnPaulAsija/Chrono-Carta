import { type SupabaseClient } from "@supabase/supabase-js";

export interface UserProfile {
  id: string;
  display_name: string;
  url: string | null;
  role_id: number;
  created_at: string;
}

// Returns the calling user's public.users row.
//
// Server Actions in app/(admin)/actions.ts call this immediately
// after resolving the session: an authenticated JWT with no matching
// profile row is a hard fail (an account that bypassed the manual
// onboarding flow). RLS already isolates users to their own row, so
// passing in the session's auth.uid() is the canonical use.
//
// Throws on error or missing row; callers translate the throw into
// the right user-facing response (401 for Server Actions, redirect
// for middleware).
export async function requireUserProfile(
  client: SupabaseClient,
  userId: string,
): Promise<UserProfile> {
  const { data, error } = await client
    .from("users")
    .select("id, display_name, url, role_id, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`requireUserProfile failed: ${error.message}`);
  }
  if (!data) {
    throw new Error("user profile not found");
  }
  return data as UserProfile;
}
