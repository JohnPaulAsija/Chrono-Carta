# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Status

**Pre-implementation.** The repo currently contains only [chrono-carta-architecture.md](chrono-carta-architecture.md) and git scaffolding — no `package.json`, no Next.js project, no `supabase/migrations/`. There are no build, lint, test, or run commands yet; they will exist once the app is scaffolded per the architecture.

The architecture document is the source of truth for design decisions. Read it before making structural choices. When something in the doc conflicts with what you're about to do, either update the doc first or flag the conflict.

## What ChronoCarta Is

A browser-based educational game in the style of GeoGuessr: players see a rendered political map (colored regions, entity names) and guess what time period it depicts. Maps are pre-filtered slices of the Cliopatria geospatial dataset, stored in Supabase. Curators create maps through an admin panel; players play through a public game flow.

## Stack (Planned)

- **Next.js App Router** with React Server Components and Server Actions
- **Supabase Postgres** for map metadata (including pre-filtered GeoJSON in `jsonb`), users, roles
- **Supabase Auth** for curator/admin login (no self-registration in v1 — disable sign-ups in Supabase settings)
- **`react-simple-maps`** for GeoJSON polygon rendering
- **Firebase App Hosting** (Cloud Run) for deploy; secrets in Cloud Secret Manager
- **Jest + React Testing Library** for unit/component tests; **Playwright** for E2E; integration tests run against a dedicated Supabase test project

## Architectural Invariants (Easy to Violate)

These are the constraints most likely to be silently broken if you don't know about them. Every one of them comes directly from the architecture doc.

### 1. Two-client security boundary

There are **two** server-side Supabase clients with very different security profiles, and they must not cross route groups:

- `getGameClient()` — uses `SUPABASE_SECRET_KEY` (the modern `sb_secret_*` key, Postgres `service_role`), **bypasses RLS**. Used **only** in `app/(game)/actions.ts`. Access control for gameplay is the signed JWT game state token, not RLS.
- `getCuratorClient(session)` — built from the curator's JWT, **respects RLS**. Used **only** in `app/(admin)/actions.ts`. The required `session` parameter is a deliberate guardrail: you can't construct one without an authenticated session.

A cross-import between these route groups (e.g., `getGameClient` imported into the admin actions, or vice versa) is an immediate red flag. If the secret key leaks into the admin path, RLS is silently bypassed and curators can edit each other's maps. If the curator client is used in gameplay, anonymous players hit permission errors and the game breaks.

The browser-side publishable-key client is for **Supabase Auth session management only** — never for data reads or writes.

### 2. The correct answer must never reach the client before a guess

- Gameplay Server Actions return only the four pre-formatted display strings (combined and shuffled from `formatted_correct` + `formatted_wrong`), the `geojson_data`, and viewport settings. The raw `correct_year`, `wrong_answers`, and `precision` columns stay server-side.
- `geojson_data` is pre-stripped at map creation time — `FromYear`, `ToYear`, `Area`, `Wikipedia`, `SeshatID`, `Type`, and `Components` are removed; only `Name`, `geometry`, `MemberOf`, and a pre-assigned `color` survive. Inspecting the network response should reveal nothing about the year.
- The game state JWT carries map IDs and progress but **never** correct answers. JWTs are signed, not encrypted — assume any field in the payload is publicly readable.

### 3. Year representation

- Years are signed integers: positive for AD, negative for BC. **There is no year 0** — reject 0 at the form level and in `formatAnswer`. The century formula `Math.ceil(absValue / 100)` works for both eras precisely because `absValue` is non-zero.
- Each `wrong_answer` is independently signed — a single map's options can legitimately span the BC/AD boundary. Duplicate-detection compares sign-converted values (so "400 BC" and "400 AD" are distinct, but two "400 BC" entries are not).
- `formatAnswer(value, precision)` runs **at map creation time**, never at game time. Results are stored in `formatted_correct` / `formatted_wrong`. The client never sees the raw integer or the precision level during gameplay.

### 4. Game state token is ephemeral

The JWT lives in React state for the duration of the session — **not** localStorage, sessionStorage, or a cookie. Refresh = new game. This is intentional. The server is stateless about tokens; old tokens are not invalidated server-side, which means a token-replay cheat is possible and accepted as a v1 trade-off (no leaderboard, no stakes).

### 5. Project structure enforces the security boundary

```
app/
├── (game)/         # uses getGameClient() — anon players, secret-key reads bypass RLS
└── (admin)/        # uses getCuratorClient(session) — authenticated curators, RLS-enforced
```

`lib/supabase/` holds the three client factories. `lib/cliopatria.ts` is the dataset loader/filter. `lib/game-state.ts` holds `signToken`, `verifyToken`, `formatAnswer`, and `assembleOptions`. `lib/map-colors.ts` holds `assignColors` (graph-coloring with `MemberOf`-based color families).

### 6. Cliopatria dataset lives on the filesystem, not in Supabase

The full ~50–100 MB Cliopatria GeoJSON is a static asset on the server. It's loaded into memory on first access and cached for the lifetime of the process. Cold starts pay a 1–2s load cost. Per-map filtered output (~100–500 KB) is what gets written to `maps.geojson_data` at creation time.

### 7. Desktop/tablet only

Below ~768px, render a "best on a larger screen" message rather than a degraded gameplay experience. The start screen, credits, and other non-gameplay views stay accessible at any size.

## Code Quality & Conventions

**TypeScript:** `strict: true`, `noUncheckedIndexedAccess: true`. No `any` without a one-line justification.

**Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `test:`, `refactor:`, `docs:`). Atomic — one logical change per commit. The message answers *why*; the diff answers *what*.

**PRs:** One coherent story per PR, readable top-to-bottom in one sitting. No grab-bag changes. The PR description names the goal and surfaces any non-obvious decisions.

**Branches:** Phase / feature branches are merged into `main` with `--no-ff` so the merge commit captures the boundary, and are **kept around** afterward — do not run `git branch -d`. The branch name is part of the project's history.

**Comments:** Default to none. Add one only when the *why* would be non-obvious to a cold reader — a hidden constraint, a security invariant, a workaround for a specific bug. Don't restate what well-named code already says. Don't reference the current task or fix in a comment; that belongs in the commit message.

**Anti-patterns to avoid:**

- Defensive code for cases that can't happen — validating internal callers, `try/catch` around code that doesn't throw.
- Stubs, half-finished branches, commented-out code, or orphan TODOs left on `main`.
- Generic error handling that swallows context (`"Something went wrong"` with no detail logged).
- Premature abstractions — three similar lines is better than a too-early helper.
- Re-exporting types or aliasing imports for backward compatibility with code that doesn't exist yet.

**Tests as specs:** Test names describe behavior in plain English. Table-driven where it clarifies the matrix being covered. A reader should be able to learn what a function does by reading its tests.

**Architecture doc as living source:** [chrono-carta-architecture.md](chrono-carta-architecture.md) is the source of truth and stays accurate as the code evolves. Drift between the doc and the code is treated as a bug — fix the doc in the same PR as the change.

## Environment Variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | server + client | Project URL. `NEXT_PUBLIC_` so the browser auth client can read it. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | client | `sb_publishable_*` key, browser-side auth only |
| `SUPABASE_SECRET_KEY` | server only | `sb_secret_*` key — `getGameClient()`, bypasses RLS, never expose |
| `GAME_STATE_SECRET` | server only | Signs/verifies game state JWTs |
| `ROUNDS_PER_GAME` | server | Default 10 |

Test suite runs against a Supabase **branch** of the main project (the `TEST` branch pre-launch — same Supabase project, isolated database): `SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY` (CI secrets / `.env.local`, gitignored).

## Database & Migrations

Schema is managed via Supabase CLI migrations in `supabase/migrations/` (version-controlled), applied to the live project via the Supabase MCP's `apply_migration` tool. `supabase/seed.sql` populates the three roles (`admin`, `curator`, `player`).

**Branch workflow — TEST-first, always.** All migrations, seed inserts, ad-hoc SQL, and other database operations target the `TEST` branch (project ref `gcojdomtucucxhjcmays`) first. Once verified there, the changes are promoted to `main` via `merge_branch`. Never apply migrations or run `execute_sql` directly against the `main` branch; doing so creates drift between the two branches and bypasses the verification step. The only exception is data that is intentionally main-branch-only — none in v1.

The production project doesn't exist yet — it's created at v1 launch and the accumulated migrations are applied at that point.

## Pending Follow-Ups

Tracked here so they don't get lost. Each entry should name a date/window for action and the rough scope.

- **Bump GitHub Actions runners off Node.js 20** — flagged by the CI deprecation notice on the Phase 4 run. `actions/checkout@v4` and `actions/setup-node@v4` run on Node 20, which gets removed from runners **2026-09-16**. Revisit around **mid-to-late May 2026**: either pin newer action major versions (e.g. `actions/checkout@v5` once stable) or set `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` on the workflow. Not blocking anything until well past v1 launch.
- **Move App Hosting backend to `us-west1`** — current backend is in `us-east4`; Supabase is in `us-west-2`. Recreate before public launch to cut ~50–75 ms off Server-Action latency.

## Out of Scope for v1

Player accounts, leaderboards, tiered guessing, themed decks, timed mode, performance/load testing, visual regression. The `player` role exists in the schema to support future leaderboard work without a migration, but is unused in v1.
