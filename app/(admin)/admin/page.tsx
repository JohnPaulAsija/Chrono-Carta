import { redirect } from "next/navigation";
import { requireUserProfile } from "@/lib/auth/profile";
import { getServerSupabase } from "@/lib/supabase/server-client";

interface MapRow {
  id: string;
  title: string;
  active: boolean;
  created_at: string;
}

export default async function AdminPage() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should redirect any unauthenticated request before it
  // gets here. Belt-and-suspenders check in case middleware is ever
  // mis-configured for a sub-path.
  if (!user) {
    redirect("/admin/login");
  }

  // Throws "user profile not found" if the auth user has no matching
  // public.users row. Surfaces as a 500 via the Next.js error boundary,
  // which is correct: this is an account-onboarding-skipped state, not
  // a recoverable one.
  const profile = await requireUserProfile(supabase, user.id);

  // RLS narrows to the curator's own rows, or all rows for admin.
  const { data, error } = await supabase
    .from("maps")
    .select("id, title, active, created_at")
    .order("created_at", { ascending: false });
  if (error) {
    throw new Error(`Failed to load maps: ${error.message}`);
  }
  const maps = (data ?? []) as MapRow[];

  return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Maps
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Signed in as <span data-testid="signed-in-name">{profile.display_name}</span>
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm font-medium text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
          >
            Sign out
          </button>
        </form>
      </header>

      {maps.length === 0 ? (
        <section
          data-testid="maps-empty-state"
          className="rounded-lg border border-dashed border-zinc-300 px-8 py-16 text-center dark:border-zinc-700"
        >
          <p className="text-lg text-zinc-700 dark:text-zinc-300">
            You have no maps yet.
          </p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-500">
            Map creation lands in a later phase. This view confirms the
            login + RLS path works end-to-end.
          </p>
        </section>
      ) : (
        <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
          {maps.map((map) => (
            <li
              key={map.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-zinc-900 dark:text-zinc-50">
                {map.title}
              </span>
              {!map.active && (
                <span className="text-xs uppercase tracking-wide text-zinc-500">
                  Inactive
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

async function signOut() {
  "use server";
  const supabase = await getServerSupabase();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
