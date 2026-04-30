import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// Load .env.local first so local runs pick up the same Supabase TEST
// credentials CI uses through repo secrets. CI sets env directly.
loadEnv({ path: ".env.local", quiet: true });

// E2E tests always run against the TEST branch — even locally where
// the dev server's normal target is the main branch. Overriding here
// keeps tests isolated from real curator data and matches what CI does.
const supabaseTestUrl = process.env.SUPABASE_TEST_URL;
const supabaseTestPublishableKey = process.env.SUPABASE_TEST_PUBLISHABLE_KEY;
const supabaseTestSecretKey = process.env.SUPABASE_TEST_SECRET_KEY;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      // Force the dev server at the TEST branch so E2E never touches
      // the main branch's data. Override every Supabase var so client
      // and server don't end up split across environments.
      NEXT_PUBLIC_SUPABASE_URL: supabaseTestUrl ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: supabaseTestPublishableKey ?? "",
      SUPABASE_SECRET_KEY: supabaseTestSecretKey ?? "",
    },
  },
});
