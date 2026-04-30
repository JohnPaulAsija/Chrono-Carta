# ChronoCarta v1 Master Development Plan

> **For Claude:** This file is a roadmap, not an executable plan. The detailed implementation plans for each phase live in their own `docs/plans/2026-04-30-phase-N-*.md` files; use `superpowers:executing-plans` against the relevant phase file when working that branch.

**Goal:** Carry ChronoCarta from "auth slice live in production" (the state at the end of the bootstrap plan, Phase 5) to v1 launch. Every column in the `maps` schema becomes reachable through real curator UI; players can complete a full game; the production environment exists; CI keeps everything green throughout.

**Tech Stack carried forward from the bootstrap plan:** Next.js App Router (TypeScript, strict + `noUncheckedIndexedAccess`), Supabase (Postgres + Auth, two-client boundary via `getGameClient` and `getServerSupabase`), Jest + RTL for unit/component/integration, Playwright for E2E, Firebase App Hosting on Cloud Run, GitHub Actions CI, Tailwind v4 for styles. New for v1: `react-simple-maps` for polygon rendering, `jose` for the game-state JWT, `@turf/turf` (likely) for polygon adjacency.

**Architecture invariants** (from `chrono-carta-architecture.md` and `CLAUDE.md`, repeated for emphasis): two-client boundary enforced by route group; correct answers never reach the client before a guess; signed integer years with no year 0; ephemeral game-state JWT in React state only; Cliopatria on the filesystem, per-map filtered output in `maps.geojson_data`; desktop/tablet only.

---

## State at start of this plan

What the bootstrap plan (Phases 0–5) delivered:

- Repo scaffold, license, README, env templates.
- Next.js scaffold with `(game)` and `(admin)` route groups; Tailwind v4; Jest configured with `unit` + `integration` projects; `ts-node` for the TS Jest config; ESLint clean.
- Supabase TEST and main branches with the v1 schema, RLS policies (curator/admin-aware), `private.is_admin()` helper, hardened advisor findings, three roles seeded.
- Three Supabase clients: `getGameClient()` (secret key, RLS bypass), `getServerSupabase()` (cookies-based, RLS-enforced), `getBrowserClient()` (publishable key, auth only).
- `formatAnswer(value, precision)` with full era × precision matrix; 43 unit tests.
- `requireUserProfile(client, userId)` helper used by the admin Server Component as its first production caller.
- 14 RLS integration tests against the live TEST branch via a real curator/admin signin.
- Firebase App Hosting backend `chrono-carta` in `us-east4`, secrets in Cloud Secret Manager, `apphosting.yaml`, GitHub Actions CI running lint + typecheck + unit + integration + build + Playwright E2E (3 specs), branch retention rule, TEST-first migration workflow.
- A production-deployed login slice: `/admin/login` for curator login, proxy enforcement of `/admin/*`, an admin Server Component that lists maps via RLS-narrowed query and renders the empty state.

What this plan adds: the rest of v1 — Cliopatria-backed map creation, a player game loop, the wrapper views, and the production launch.

---

## Branch sequence and rationale

The order below is "build the layers from the bottom up so each layer compiles against a stable surface beneath it." Each phase ends with a `--no-ff` merge into `main`; the phase branch is retained per the retention rule. CI runs on every push to main.

### Phase 6 — Cliopatria backend ([detail](2026-04-30-phase-6-cliopatria-backend.md))

`lib/cliopatria.ts` exposing `loadCliopatria()` (lazy, in-memory cached), `filterByYear(year)`, and `stripYearData(features)`. Adds the Cliopatria GeoJSON file under `public/data/` (large enough that we'll handle it via a one-time download script, not Git LFS, to keep the repo portable).

**Why first.** Every later phase that touches map content depends on the dataset being readable. There's no UI here; pure logic that's fully unit-testable without a browser.

### Phase 7 — Map viewer component ([detail](2026-04-30-phase-7-map-viewer-component.md))

`react-simple-maps` integration. `app/(game)/play/MapViewer.tsx` (Client Component) renders a `geojson_data` blob with permanent labels above a size threshold, hover tooltips, and a legend panel of unlabeled entities. Pan/zoom controls. Highlighting state shared between map and legend.

**Why second.** Both Phase 9 (creation preview) and Phase 12 (gameplay) instantiate this component, so building it before either consumer means downstream work is mostly composition. Building it before Phase 8's coloring algorithm also gives that algorithm a render to validate against — adjacent same-color regions show up immediately in a map view, which test assertions alone won't catch as cheaply.

### Phase 8 — Color assignment ([detail](2026-04-30-phase-8-color-assignment.md))

`lib/map-colors.ts` exposing `assignColors(features)`. Computes polygon adjacency, applies graph coloring with a 8–12 color palette, derives color families from the `MemberOf` relation so composite entities (e.g. states inside the Holy Roman Empire) share a hue.

**Why third.** With the Phase 7 viewer in place, the graph-coloring output is visually verifiable as the algorithm takes shape — render a colored fixture, eyeball it, fix the obvious mistakes. Splitting from Phase 6 keeps the data-loading concern clean and lets this phase land a self-contained algorithm that the pre-storage pipeline plugs into at map creation time.

### Phase 9 — Map creation flow ([detail](2026-04-30-phase-9-map-creation-flow.md))

`app/(admin)/admin/create/page.tsx` and an admin Server Action `createMap`. Full curator UI: year + AD/BC toggle → preview → viewport framing → metadata (title, precision, three wrong answers each with AD/BC, reveal text, optional difficulty + tags). Server-side validation, calls into Phase 6 + 8 to produce the row, runs `formatAnswer` to fill `formatted_correct` / `formatted_wrong`.

**Why fourth.** First user-facing consumer of Phases 6, 7, 8. After this phase, real maps exist in the database — every later phase has data to work against.

### Phase 10 — Map management ([detail](2026-04-30-phase-10-map-management.md))

Replaces the empty-state in `app/(admin)/admin/page.tsx` with a real list view; adds `app/(admin)/admin/edit/[id]/page.tsx` (form pre-filled from the map row); a `deactivateMap` Server Action toggling `active`. Admin sees all maps (cross-curator); curator sees their own.

**Why fifth.** Editing and deactivation are quality-of-life polish on top of creation; they're not blocking gameplay. Deferring them lets Phase 9 ship a pure happy-path creation form without coupling to edit-mode logic.

### Phase 11 — Gameplay backend ([detail](2026-04-30-phase-11-gameplay-backend.md))

`lib/game-state.ts` grows: `signToken(payload)`, `verifyToken(token)`, `assembleOptions(map)`. New: `app/(game)/actions.ts` with `startGame()`, `submitGuess(token, guess)`, both using `getGameClient()`. JWT lifecycle per architecture §Game State Token Lifecycle.

**Why sixth.** Pure backend; no UI. Testable end-to-end with Jest. Stops the play UI from having to bolt logic on at the same time.

### Phase 12 — Gameplay UI ([detail](2026-04-30-phase-12-gameplay-ui.md))

`app/(game)/play/page.tsx` (Server Component shell), `GameBoard.tsx`, the reveal screen, the end screen. Composes `MapViewer` from Phase 7, calls Server Actions from Phase 11, renders multiple-choice options, transitions through rounds, shows the per-round summary.

**Why seventh.** First consumer of the gameplay backend. After this phase, the full play loop works: start → guess → reveal → end. Gating the UI on the backend means we never write client code that proxies for missing server code.

### Phase 13 — Player views ([detail](2026-04-30-phase-13-player-views.md))

Real start screen (replacing the Next.js placeholder), credits page with curator list + Cliopatria attribution, footer attribution on every page, the "best on a larger screen" viewport gate below ~768px.

**Why eighth.** These views are the wrapper around gameplay. Building them earlier means the start screen's "Play" button leads nowhere; after Phase 12 it leads to a working game. The credits page is mostly static content but worth its own focused branch so the page list and prose can be reviewed cleanly.

### Phase 14 — Launch prep ([detail](2026-04-30-phase-14-launch-prep.md))

Create the production Supabase project (separate from main/TEST). Apply migrations. Update `apphosting.yaml` and Cloud Secret Manager to point at production. Migrate App Hosting to `us-west1` for Supabase locality. Branch protection on `main`. Update CLAUDE.md to drop the pre-launch carve-outs.

**Why last.** Touches infrastructure that affects everyone. We want the codebase fully feature-complete and stable before swapping environments. Doing this earlier means re-doing it when post-launch realities change something.

---

## Sequencing notes

**Truly serial.** 6 → 8 → 9 must be sequential (creation depends on both), 7 must precede 9 and 12 (viewer is consumed by both), 11 must precede 12.

**Could parallelise.** Phases 7 and 8 don't depend on each other — the map viewer is pure client rendering with placeholder fixtures, color assignment is pure server logic. If two contributors work in parallel, one takes 7, the other takes 8, both merge before starting 9. Solo, they're sequential — and 7 first lets you validate 8's output visually, which is why this plan orders them that way.

Phase 10 (management) and Phase 11 (gameplay backend) don't share files; they could parallelise too, with the caveat that Phase 11 will land changes to `lib/game-state.ts` that Phase 12 reads.

**Doc updates per phase.** Every phase updates the architecture doc and CLAUDE.md if either drifts. The plan's deviations section grows whenever execution diverges from the original intent.

**Dataset size.** Cliopatria is 50–100 MB. Phase 6 introduces a download script and gitignores the file itself. CI will run the download on first install (cached after that). This is a real piece of complexity that would surprise a reviewer if it weren't called out — Phase 6's plan addresses it explicitly.

**Component test discipline.** Every UI phase (8, 9, 10, 12, 13) lands its own component tests. The architecture's §Component Tests section enumerates the cases per component; each phase plan has a checklist of those cases. There's no separate "testing phase" — tests ship with the feature they cover.

**Branch protection lands in Phase 14, not before.** Pre-launch we want fast iteration and direct commits to main when sensible (we've done this for small fixups). Branch protection requires PRs and review, which adds friction we don't want during heavy development. After Phase 14 merges, main becomes protected.

**Production launch is the cut.** The end of Phase 14 is also the end of v1's pre-launch period. After that, the "TEST-first" rule extends to "TEST → main → production" — every migration walks all three branches via `merge_branch` chains. CLAUDE.md will document the post-launch workflow at that point.

---

## What this plan does NOT cover

Per architecture §Out of Scope for v1: leaderboards, player accounts, tiered guessing, themed decks, timed mode, performance/load testing, visual regression. Each is a v2+ feature plan when its time comes. Pending follow-ups (Node 20 actions deprecation, HIBP password protection, App Hosting region) are tracked in CLAUDE.md and not blocking any v1 phase.

---

## Tracking

The detailed phase plans contain the bite-sized tasks. As phases land, this master file gets a checkmark next to each entry above and the plan-deviations section in `2026-04-29-project-bootstrap.md` grows when execution diverges from the original specs.
