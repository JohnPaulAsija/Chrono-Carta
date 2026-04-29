import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Secret-key client. Bypasses RLS. For app/(game)/actions.ts only —
// importing this anywhere under app/(admin) is a security regression.
export function getGameClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "getGameClient requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
