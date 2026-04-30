import { config } from "dotenv";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Load .env.local for local runs. CI sets vars directly via the
// workflow yaml so dotenv silently no-ops there.
config({ path: ".env.local", quiet: true });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required for integration tests; set it in .env.local or CI secrets`,
    );
  }
  return value;
}

// Anon-role client against the TEST branch. Used to verify that
// unauthenticated callers get the deny-by-default treatment from RLS.
export function anonClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_TEST_URL"),
    requireEnv("SUPABASE_TEST_PUBLISHABLE_KEY"),
    { auth: { persistSession: false } },
  );
}
