# Phase 14 — Launch Prep Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans. This phase deliberately leans manual — Supabase project creation, Firebase backend recreation, and branch protection are all dashboard-driven actions that can't be safely automated through MCP for the first time.

**Goal:** Cut over from the pre-launch one-project setup (main branch = dev, TEST branch = test) to a real production split (separate Supabase production project, separate Cloud Secret Manager values, App Hosting in `us-west1`). Land branch protection on `main`. Update CLAUDE.md to drop the pre-launch carve-outs.

**Architecture:** Per architecture §Database Migrations: "When v1 is ready to launch, the production project is created and `supabase db push` applies all migrations at once." This phase is that moment.

**Tech Stack:** Supabase MCP for project creation + migration push. Firebase Console for App Hosting backend recreation. GitHub Settings for branch protection. No new code dependencies.

---

## Task 1: Create the production Supabase project

**Step 1:** Use the Supabase MCP `create_project` tool. Name: `chrono-carta-prod`. Region: `us-west-2` (matches the planned `us-west1` App Hosting region for low-latency Server Actions).

**Step 2:** `confirm_cost` if MCP requires it.

**Step 3:** Capture the project ref + URL. Save to memory file (similar shape to `supabase_test_project.md`).

**Step 4:** Disable email sign-ups in the dashboard. Confirm via curl to `/auth/v1/signup` with a valid-format email — expect `signup_disabled`.

---

## Task 2: Apply all migrations to production

The accumulated migrations from Phases 2 and 7+ all apply. Use the MCP `apply_migration` tool for each file in `supabase/migrations/` in version order.

After each apply: `get_advisors` against the new project. Resolve any non-INFO findings before continuing. (Compare against the main-branch advisor output as the baseline — anything new is something this phase introduced.)

**Step 1:** Apply `20260429120000_init.sql`.
**Step 2:** Apply `20260429120001_rls.sql`.
**Step 3:** Apply `20260429120002_security_hardening.sql`.
**Step 4:** Apply `20260429120003_users_admin_read.sql`.
**Step 5:** Apply any phase 6+ migrations that landed.

**Step 6:** Run `seed.sql` via `execute_sql` to populate the three roles.

**Step 7:** `list_migrations` against prod → all entries present.

---

## Task 3: Move runtime config to point at production

**Files:**
- Modify: `apphosting.yaml`
- Modify: `.env.local` (curator's local copy — not committed)
- (Cloud Secret Manager values updated via `firebase apphosting:secrets:set`)

`apphosting.yaml` updates:
- `NEXT_PUBLIC_SUPABASE_URL` → production URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` → production publishable key
- (secret refs unchanged; values in Cloud Secret Manager swap)

CLI commands:
```
firebase apphosting:secrets:set supabase-secret-key
# paste production secret key
firebase apphosting:secrets:set game-state-secret
# paste a freshly generated production-only GAME_STATE_SECRET
```

Commit:
```
git commit -m "feat(deploy): point app hosting at production supabase project"
```

CI continues to use the **TEST** branch (not production) — that's correct. Production should never see test traffic.

---

## Task 4: Recreate App Hosting backend in `us-west1`

App Hosting region is set per-backend at creation time and cannot be changed in place. To migrate region:

**Step 1:** In Firebase Console → App Hosting, create a new backend `chrono-carta-prod` in region `us-west1` connected to the same GitHub repo / `main` branch.

**Step 2:** Wait for the first build to succeed.

**Step 3:** Verify the new URL serves the app: `curl https://chrono-carta-prod--<project-id>.us-west1.hosted.app/`.

**Step 4:** Cut over (custom domain pointing if applicable, or update README live-demo link).

**Step 5:** Delete the old `chrono-carta` backend in `us-east4` once the new one is healthy.

**Step 6:** Update README's live-demo link to the new URL.

Commit:
```
git commit -m "docs(readme): update live demo url to us-west1 backend"
```

---

## Task 5: Create production auth users

In the production Supabase dashboard:
- Add the curator + admin auth users (real production credentials, not the dev passwords).
- Capture UUIDs.
- Insert matching `public.users` rows via MCP `execute_sql` against the production project.

This is the production equivalent of what we did for TEST in Phase 2 and main in Phase 5.

---

## Task 6: Branch protection

GitHub repo Settings → Branches → Add rule for `main`:
- Require pull requests + 1 approval
- Require CI workflow to pass
- Disallow force pushes
- Disallow deletions

Pre-launch we worked directly on main (and within phase branches that merged via `--no-ff`). Post-launch, every change goes through a PR.

---

## Task 7: Update CLAUDE.md to drop pre-launch carve-outs

Pre-launch language to remove or update:
- "the test project doubles as dev" → no longer true; production exists
- The TEST-first migration workflow expands: TEST → main (dev) → production. Or simpler: TEST → production directly, with main treated as a long-lived dev environment that doesn't need migrations from TEST. Pick one and document.
- Branch retention rule still applies.
- The "App Hosting region" and "HIBP password protection" follow-ups can be marked done.

Commit:
```
git commit -m "docs(claude): update post-launch workflow rules"
```

---

## Task 8: Update bootstrap plan + master plan checkmarks

**Files:**
- Modify: `docs/plans/2026-04-29-project-bootstrap.md` deviations section: note that pre-launch period ended.
- Modify: `docs/plans/2026-04-30-master-development.md`: add a closing note that all 9 phases landed.

Commit:
```
git commit -m "docs(plan): mark v1 bootstrap + master development complete"
```

---

## Verification before merge

- Production URL serves the app.
- Auth users can log in to the production admin panel.
- A throwaway test PR runs CI green and gets a Firebase preview URL.
- Branch protection blocks a direct push to main (verify by attempting one — should be rejected).

## Merge

This is the final phase. After it merges and v1 is officially launched, post-launch rules apply: every change goes through a PR.
