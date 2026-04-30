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

// Title prefix on every test-created map so cleanupTestMaps can scope
// its delete and never touch real curator data.
export const TEST_MAP_PREFIX = "RLS_TEST_";

// Anon-role client against the TEST branch.
export function anonClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_TEST_URL"),
    requireEnv("SUPABASE_TEST_PUBLISHABLE_KEY"),
    { auth: { persistSession: false } },
  );
}

// Service-role client. Bypasses RLS. Used for fixture setup and
// teardown, never to assert RLS behavior under test.
export function adminBypassClient(): SupabaseClient {
  return createClient(
    requireEnv("SUPABASE_TEST_URL"),
    requireEnv("SUPABASE_TEST_SECRET_KEY"),
    { auth: { persistSession: false } },
  );
}

const ROLE_CREDS = {
  curator: {
    email: "johnasija@outlook.com",
    passwordEnv: "TEST_CURATOR_PASSWORD",
  },
  admin: {
    email: "john@johnasija.com",
    passwordEnv: "TEST_ADMIN_PASSWORD",
  },
} as const;

type Role = keyof typeof ROLE_CREDS;

export interface SignedInClient {
  client: SupabaseClient;
  userId: string;
  accessToken: string;
}

// Sign in as the seeded curator/admin and return a client whose
// requests carry their JWT — so PostgREST evaluates RLS as that user.
export async function signInAs(role: Role): Promise<SignedInClient> {
  const { email, passwordEnv } = ROLE_CREDS[role];
  const password = requireEnv(passwordEnv);

  const auth = anonClient();
  const { data, error } = await auth.auth.signInWithPassword({ email, password });
  if (error || !data.session || !data.user) {
    throw new Error(
      `signInAs(${role}) failed: ${error?.message ?? "no session returned"}`,
    );
  }

  const client = createClient(
    requireEnv("SUPABASE_TEST_URL"),
    requireEnv("SUPABASE_TEST_PUBLISHABLE_KEY"),
    {
      auth: { persistSession: false },
      global: {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      },
    },
  );

  return {
    client,
    userId: data.user.id,
    accessToken: data.session.access_token,
  };
}

// Minimal valid map row honoring every NOT NULL column and check
// constraint in supabase/migrations/20260429120000_init.sql.
// Title carries TEST_MAP_PREFIX so cleanup can scope its delete.
export function mapFixture(createdBy: string, suffix = "default") {
  return {
    title: `${TEST_MAP_PREFIX}${suffix}_${Date.now()}`,
    geojson_data: { type: "FeatureCollection", features: [] },
    correct_year: 1815,
    precision: "year",
    wrong_answers: [1789, 1812, 1820],
    formatted_correct: "1815 AD",
    formatted_wrong: ["1789 AD", "1812 AD", "1820 AD"],
    center_lat: 48.0,
    center_lng: 15.0,
    zoom_level: 3,
    reveal_text: "Test reveal",
    difficulty: "medium",
    created_by: createdBy,
  };
}

// Seeds a map for tests that need pre-existing data. Runs through the
// service-role client so it ignores RLS — we want fixture setup to be
// independent of the policies we're trying to test.
export async function seedTestMap(
  createdBy: string,
  suffix = "seed",
): Promise<{ id: string }> {
  const { data, error } = await adminBypassClient()
    .from("maps")
    .insert(mapFixture(createdBy, suffix))
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`seedTestMap failed: ${error?.message ?? "no row returned"}`);
  }
  return data;
}

// Removes every map whose title carries TEST_MAP_PREFIX. Real curator
// data, which never carries that prefix, is untouched.
export async function cleanupTestMaps(): Promise<void> {
  const { error } = await adminBypassClient()
    .from("maps")
    .delete()
    .like("title", `${TEST_MAP_PREFIX}%`);
  if (error) {
    throw new Error(`cleanupTestMaps failed: ${error.message}`);
  }
}
