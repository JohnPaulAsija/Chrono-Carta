import {
  createClient,
  type Session,
  type SupabaseClient,
} from "@supabase/supabase-js";

// User-JWT client. RLS-enforced. For app/(admin)/actions.ts only.
// The non-optional `session` parameter is the architectural guardrail:
// an unauthenticated call is a compile-time error, not a silent
// security bug at runtime.
export function getCuratorClient(session: Session): SupabaseClient {
  const url = process.env.SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "getCuratorClient requires SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    },
  });
}
