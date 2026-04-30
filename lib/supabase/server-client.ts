import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

// SSR-aware Supabase client for server contexts: middleware,
// Server Components, and Server Actions in app/(admin)/. Reads the
// session from the cookies set by Supabase Auth, so PostgREST
// evaluates RLS as the calling user.
//
// The security boundary is enforced by the route-group split — the
// secret-key getGameClient() never lives under app/(admin), so an
// admin path always reaches Supabase via this RLS-respecting helper.
//
// Server Components cannot mutate cookies in Next.js App Router; the
// setAll guard tolerates that. Cookie refreshes for token rotation
// happen on the next request that flows through middleware or a
// Server Action, both of which can write.
export async function getServerSupabase(): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error(
      "getServerSupabase requires NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Called from a Server Component context where cookie
          // writes are forbidden. Middleware will refresh on the
          // next round-trip.
        }
      },
    },
  });
}
