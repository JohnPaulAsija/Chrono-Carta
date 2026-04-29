# ChronoCarta Bootstrap Plan

> **For Claude:** Use superpowers:executing-plans to implement this plan task-by-task. Each phase ends in a commit (and a PR once CI is live).

**Goal:** Stand up the foundation — Next.js scaffold, Supabase test project, RLS policies validated by integration tests, Firebase App Hosting, and CI — so subsequent feature plans build against a known-good security boundary.

**Architecture:** Per [chrono-carta-architecture.md](../../chrono-carta-architecture.md). Two-client Supabase pattern (gameplay uses the secret key + signed JWT, admin uses user JWT + RLS). One Supabase project pre-launch with two branches: `main` (dev) and `TEST` (integration tests). The production project and its secrets are not created until v1 launch.

**Tech Stack:** Next.js App Router (TypeScript), Supabase Postgres + Auth, Jest + React Testing Library + Playwright, Firebase App Hosting (Cloud Run), GitHub Actions.

## Execution-time deviations from this plan

These are decisions made during execution that diverge from the original plan. They are documented here rather than rewriting earlier phase sections so the chronology stays legible.

- **Phase 3 ↔ Phase 4 swap.** CI/CD is set up immediately after the Next.js scaffold (the original Phase 4) so that Phase 3's TDD work runs under green CI from commit one. The integration-test job is wired in as a no-op (`--passWithNoTests`) until Phase 3 lands tests; then it activates automatically. Recorded 2026-04-29.
- **Supabase branching.** The architecture's "test project doubles as dev" guidance is realised as one Supabase project with two branches — `main` (project ref `dyswgwgmilmjjmtmuwdf`) for dev, `TEST` (project ref `gcojdomtucucxhjcmays`) for integration tests. CLAUDE.md captures the TEST-first migration workflow.
- **Live infra is managed via the Supabase MCP** (apply_migration, execute_sql, etc.) rather than the CLI's `db push` against a local Docker stack. The CLI is still installed for migration authoring and link operations. `supabase init`'s `config.toml` was deleted because we never run a local Docker stack.
- **Modern Supabase key naming** (`sb_publishable_*` / `sb_secret_*`) is used throughout — env vars are `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY`. The legacy anon JWT / service-role JWT format is not used. Architecture §Environment & Configuration is the source of truth.
- **App Hosting region is `us-east4`**, not the optimal `us-west1` for Supabase (`us-west-2`). This is a pre-launch suboptimality — recreate the backend in `us-west1` before public launch to cut Server-Action latency by 50–75 ms.
- **`SUPABASE_URL` renamed to `NEXT_PUBLIC_SUPABASE_URL`** during Phase 3. The architecture's table marked the URL as "Server & client" but the variable name lacked the `NEXT_PUBLIC_` prefix Next.js requires for client visibility. The browser auth client needs the URL in client bundles, so we renamed; server code reads the same variable. Architecture doc updated.

---

## Phase 0 — Repo prep

**Goal:** Directory layout, ignore rules, README, and license in place. Anyone landing on the repo's GitHub page sees a polished first impression before there's a single line of application code.

**Steps:**

1. Create directories: `app/(game)/`, `app/(admin)/`, `lib/supabase/`, `supabase/migrations/`, `tests/integration/`, `public/data/` (Cliopatria lives here later).
2. Add `.gitignore` covering `node_modules/`, `.next/`, `.env*` (allow `.env.example`), `coverage/`, `playwright-report/`, `test-results/`, `supabase/.temp/`, `*.tsbuildinfo`.
3. Add `.env.example` listing the variables from architecture §Environment & Configuration with placeholder values.
4. Add `LICENSE` — MIT, in the user's name. The Cliopatria dataset itself is CC-BY (separate licensing concern, addressed in step 5).
5. Add `README.md`:
   - One-line tagline + one-paragraph elevator pitch.
   - **Live demo** section with a placeholder link (will become the Firebase App Hosting URL once Phase 4 lands — leave a `TODO: live demo url` so it's obvious what's missing).
   - **Screenshots** section with a placeholder note (real screenshots get added once Phase 5 lands and there's something to capture).
   - **Setup** section: prerequisites (Node version, Supabase CLI), env-var checklist pointing at `.env.example`, the dev/test/build commands. Will be a stub until Phase 1 fills it in — note that explicitly so a reviewer doesn't read it as broken.
   - **Architecture** section linking to [chrono-carta-architecture.md](chrono-carta-architecture.md) with a one-sentence summary of why the doc exists (high-level design, security model, data model — read before contributing).
   - **Tech stack** section — Next.js App Router, Supabase, Firebase App Hosting, Jest/Playwright. Brief and factual.
   - **Attribution** section crediting the Seshat Cliopatria dataset under CC-BY 4.0, with a link to the dataset and the Nature Scientific Data 2025 paper. Required by the dataset license per architecture §GeoJSON Data Source.
   - **License** section pointing at `LICENSE` for the application code, distinguished from the Cliopatria attribution above.
6. Commit: `chore: scaffold repo with readme, license, and gitignore`

**Verification:** `git status` clean; directory tree matches architecture §Project Structure; the GitHub repo page renders the README cleanly with no broken links other than the explicitly-marked TODOs.

**Cliopatria attribution checklist (forward-looking):** The CC-BY requirement isn't satisfied by the README alone — the running app must also surface attribution. Track these placements as future phases land:
- README — done in this phase.
- App footer (visible on every page) — added in Phase 5 alongside the first real layout.
- Reveal screen — added when the gameplay reveal lands in a later plan, since the architecture calls out "All maps in ChronoCarta carry an attribution to the Seshat Cliopatria project."
- Credits page — added when the credits view lands.

---

## Phase 1 — Next.js scaffold

**Goal:** Running App Router app with TypeScript, the (game)/(admin) route group split in place, and Jest configured.

**Steps:**

1. Run `npx create-next-app@latest .` — choose TypeScript, ESLint, App Router, Tailwind. (Tailwind isn't required by the architecture but is the path of least resistance for the focus-ring + color-contrast requirements. Swap to CSS modules if preferred.)
2. Move generated `app/page.tsx` into `app/(game)/page.tsx`. Add a placeholder `app/(admin)/admin/page.tsx` returning "admin coming soon" — the route group split must exist from day one because it's what enforces the two-client boundary.
3. Install Jest + RTL: `npm i -D jest @types/jest jest-environment-jsdom @testing-library/react @testing-library/jest-dom ts-jest`. Create `jest.config.ts` with two projects: `unit` (jsdom) and `integration` (node).
4. Verify `npm run dev` serves both routes; `npm test` exits clean with zero tests.
5. Commit: `feat: scaffold next.js app router with jest`

**Verification:** `localhost:3000` renders the start placeholder, `localhost:3000/admin` renders the admin placeholder, `npm test` passes.

---

## Phase 2 — Supabase project, schema, RLS

**Goal:** Live Supabase test project with v1 schema, RLS policies, and seeded roles. No application code consumes it yet.

**Steps:**

1. In the Supabase dashboard, create `chrono-carta-test` under your Pro org. **Disable email sign-ups** (Authentication → Settings → Allow new users to sign up = off) per architecture §Authentication. This is non-negotiable — Supabase allows public sign-up by default.
2. Install the CLI as a dev dep: `npm i -D supabase`. Run `npx supabase init`, then `npx supabase link --project-ref <ref>`.
3. Write `supabase/migrations/<timestamp>_init.sql` with the three tables (`roles`, `users`, `maps`) per architecture §Data Model — exact columns, defaults, FK to `auth.users.id`, check constraints on `precision` and `difficulty`, unique constraint on `roles.name`.
4. Write `supabase/seed.sql` inserting the three roles (`admin`, `curator`, `player`).
5. Write `supabase/migrations/<timestamp>_rls.sql` with policies per architecture §Row-Level Security:
   - `maps`: curator SELECT/INSERT/UPDATE where `created_by = auth.uid()`; admin SELECT/INSERT/UPDATE on all rows (via `users.role_id` join to `roles.name = 'admin'`); no DELETE for anyone.
   - `users`: authenticated user SELECT on their own row only; no INSERT/UPDATE.
   - `roles`: no anon access.
6. Add the `updated_at` trigger for `maps`.
7. Push: `npx supabase db push`. Confirm in dashboard: three tables, RLS enabled on all three, three roles seeded.
8. Manually create one curator and one admin user via Authentication → Users. Insert matching `users` rows with the right `role_id`. Save the UUIDs and passwords for Phase 3 test seeding.
9. Add `.env.local` (gitignored) with `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and a freshly generated `GAME_STATE_SECRET` (`openssl rand -hex 32`).
10. Commit: `feat(db): initial schema, rls policies, role seed`

**Verification:** Dashboard shows the schema, RLS enabled, two test users wired to `users` rows. Confirm sign-ups are actually disabled by attempting one with curl.

---

## Phase 3 — Two-client boundary + RLS integration tests

**Goal:** The three Supabase clients exist, and Jest integration tests against the live test project prove the RLS boundary holds. After this phase, no UI work can silently break the security model.

**Sub-skill:** Use superpowers:test-driven-development for the test-first cycle below.

### Task 3.1 — `getGameClient()` factory

**Files:** Create `lib/supabase/game-client.ts`. Export `getGameClient()` returning a `createClient` instance with `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, `auth: { persistSession: false }`. Add a one-line comment that this client bypasses RLS and is for `app/(game)/actions.ts` only.

Commit: `feat(supabase): game-client factory (service role)`

### Task 3.2 — `getCuratorClient(session)` factory

**Files:** Create `lib/supabase/curator-client.ts`. Export `getCuratorClient(session: Session)` with the user's `access_token` injected via `global.headers.Authorization`. The required `session` parameter is the architectural guardrail — making it non-optional means an unauthenticated call is a TypeScript error, not a silent security bug.

Commit: `feat(supabase): curator-client factory (user jwt, rls)`

### Task 3.3 — Browser anon client

**Files:** Create `lib/supabase/browser-client.ts`. Use `createBrowserClient` from `@supabase/ssr` with `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Comment: "Auth session management only — never for data reads or writes."

Commit: `feat(supabase): browser anon client for auth`

### Task 3.4 — RLS integration tests

**Files:** Create `tests/integration/rls.test.ts` and `tests/integration/setup.ts`.

Per architecture §Integration Tests, write these test cases. Add them one-by-one in TDD style — write a failing test, watch it fail with the *right* error, implement helpers as needed, watch it pass, commit, move to the next.

`maps` boundary:
- Curator can INSERT a map with their own `created_by`.
- Curator can SELECT and UPDATE their own maps.
- Curator CANNOT update a map where `created_by` doesn't match.
- Admin can SELECT, INSERT, and UPDATE all maps.
- Anon user gets zero rows from `maps`.

`users` boundary:
- Anon user gets zero rows from `users`.
- Authenticated user can only SELECT their own row.

Edge cases:
- A user with a valid JWT but no matching `users` row is rejected by Server Actions (this case will be exercised against a placeholder helper now and re-validated when Server Actions land).

`tests/integration/setup.ts` exports: `signInAs(role: 'curator' | 'admin')` (uses the seeded creds), `seedTestMap(curatorId)`, and `cleanupTestMaps()`. Use the service-role client for setup/teardown.

For each test case follow the TDD micro-cycle:
1. Write the failing test.
2. Run `npm test -- --selectProjects integration -t "<test name>"`. Confirm it fails for the *expected* reason.
3. Implement helpers in `setup.ts` if needed (no app code change needed — the policies are already in the migrations).
4. Run again, confirm green.
5. Commit each test case (or batch logically related ones).

Final commit: `test(rls): integration coverage for maps, users, role boundaries`

### Task 3.5 — `formatAnswer` unit tests + impl

**Files:** Create `lib/game-state.ts` and `tests/unit/game-state.test.ts`.

Per architecture §Display Formatting and §Unit Tests, table-driven tests in TDD order:
- Century AD: 1507 → "16th century AD", 100 → "1st century AD", 99 → "1st century AD".
- Century BC: -400 → "4th century BC", -1 → "1st century BC", -100 → "1st century BC".
- Decade AD: 1507 → "1500s AD", 1800 → "1800s AD".
- Decade BC: -400 → "400s BC", -10 → "10s BC".
- Year: 1507 → "1507 AD", -400 → "400 BC", 1 → "1 AD", -1 → "1 BC".
- Ordinals 1st through 21st covered.
- Year 0 throws.

Implement, run green, commit: `feat(game-state): formatAnswer with full era and precision coverage`.

This task is small, fast, and proves the unit test runner is wired correctly — also lets `formatAnswer` exist before it's needed by the map creation flow.

---

## Phase 4 — Firebase App Hosting + CI

**Goal:** PRs run lint/typecheck/unit/integration; merges to `main` deploy to Firebase. Secrets configured in both Cloud Secret Manager and GitHub Actions.

**Steps:**

1. **Firebase project:** Create `chrono-carta` in the Firebase console. Enable App Hosting. Connect the GitHub repo. Pick a region (`us-central1` is a safe default).
2. **Secrets in Cloud Secret Manager:** `SUPABASE_SERVICE_ROLE_KEY` and `GAME_STATE_SECRET`. Reference them from `apphosting.yaml`. Add `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `ROUNDS_PER_GAME=10` as plain env entries. Note: pre-launch, these point at the test project — that's deliberate, the prod project doesn't exist yet.
3. **GitHub Actions secrets:** Add `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY` (same values as your `.env.local` — pre-launch the test project *is* the dev project).
4. **Workflow:** Create `.github/workflows/ci.yml` triggered on PRs to `main`:
   - `npm ci`
   - `npm run lint`
   - `npx tsc --noEmit`
   - `npm test -- --selectProjects unit`
   - `npm test -- --selectProjects integration`
   - `npm run build`
5. **Verify preview channels:** Open a throwaway PR with a trivial change. Confirm Firebase comments back with a preview URL and that GitHub Actions runs green. Merge and confirm production deploy succeeds.
6. **Branch protection:** On `main`, require the CI workflow to pass and at least one review.
7. Commit: `ci: github actions workflow with lint, typecheck, unit, integration, build`

**Verification:** A PR that drops an RLS policy fails the integration job. A PR with a valid build shows a Firebase preview URL.

---

## Phase 5 — First end-to-end slice

**Goal:** Prove auth + curator client + RLS work in a real browser. After this, every subsequent feature plan extends a working spine instead of bootstrapping one.

**Suggested slice:** Curator login → empty map management view ("you have no maps yet"). This slice exercises `getCuratorClient(session)` against live RLS without yet needing Cliopatria, the JWT lifecycle, or `react-simple-maps`.

**Steps:**

1. Implement `app/(admin)/login/page.tsx` using the browser anon client for `signInWithPassword`.
2. Add `middleware.ts` protecting `/admin/*` — redirect to `/admin/login` if no session.
3. Implement `app/(admin)/admin/page.tsx` as a Server Component that reads the session, calls `getCuratorClient(session)`, queries `maps` for the current user (RLS does the filtering), and renders the empty-state.
4. Add a Playwright E2E test logging in as the seeded curator and asserting the empty-state renders. Add Playwright as a CI job per architecture §CI Pipeline §5.
5. Commit + PR + merge.

**Verification:** Logged-out visitor to `/admin` is redirected. Logged-in curator sees the empty management view. Playwright passes locally and in CI. Firebase preview URL serves the same flow.

---

## What this unlocks

After Phase 5 the foundation is in place to write subsequent feature plans:
- Map creation flow (Cliopatria loader + `filterByYear` + `assignColors` + admin form + interactive preview)
- Gameplay flow (start → guess → reveal → end, with the JWT lifecycle and `assembleOptions`)
- Player views (start, end, credits)
- Map management edits and deactivation

Each gets its own `docs/plans/<date>-<feature>.md`.

---

## Notes & deferrals

- **Cliopatria dataset (~50–100 MB)** stays out of the repo until the map creation plan — no point checking it in before there's a `loadCliopatria()` function to consume it.
- **Production Supabase project** isn't created until v1 launch (architecture §Database Migrations). `apphosting.yaml` will currently point at the test project; that's intended.
- **Per-PR Playwright** is added in Phase 5, not earlier — there's nothing meaningful to E2E test until then.
- **No worktree** for this plan: the repo is green-field, so isolation buys nothing. Subsequent feature plans should use worktrees per the brainstorming → writing-plans → executing-plans flow.
