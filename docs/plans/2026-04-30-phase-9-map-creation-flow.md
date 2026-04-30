# Phase 9 — Map Creation Flow Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per superpowers:test-driven-development for every Server Action and form-validation function.

**Goal:** Curator-facing map creation: enter a year → see a live preview → frame the viewport → fill in metadata → submit. The Server Action runs the full Phase 6 + Phase 7 pipeline and writes a complete `maps` row.

**Architecture:** Per architecture §Map Creation Form and §Map Creation Flow. Three-step UX, one form, two Server Actions: `previewMap(year)` returns colored stripped GeoJSON without writing anything; `createMap(formData)` validates, runs the same filter+strip+color pipeline, runs `formatAnswer`, writes the row. Form validation runs both client-side (UX) and server-side (security).

**Tech Stack:** Next.js Server Actions, React form state, Tailwind, `MapViewer` from Phase 8, integration tests against the TEST branch.

---

## Task 1: `previewMap(year)` Server Action

**Files:**
- Create: `app/(admin)/actions.ts` (new file)
- Create: `tests/integration/preview-map.test.ts`

**Step 1: Failing integration test.**

Sign in as the seeded curator, call `previewMap(1815)` (or any year present in the test fixture-or-real Cliopatria), assert the response shape: `{ ok: true, geojson: FeatureCollection }` and that every feature has a `color` property.

**Step 2: Implement.**

```ts
"use server";

import { loadCliopatria, filterByYear, stripYearData } from "@/lib/cliopatria";
import { assignColors } from "@/lib/map-colors";

export type PreviewResult =
  | { ok: true; geojson: GeoJSON.FeatureCollection }
  | { ok: false; reason: "year-zero" | "no-entities" };

export async function previewMap(year: number): Promise<PreviewResult> {
  if (year === 0) return { ok: false, reason: "year-zero" };
  const all = await loadCliopatria();
  const filtered = filterByYear(all.features, year);
  if (filtered.length === 0) return { ok: false, reason: "no-entities" };
  const stripped = stripYearData(filtered);
  const colored = assignColors(stripped);
  return {
    ok: true,
    geojson: { type: "FeatureCollection", features: colored },
  };
}
```

**Step 3: Run, watch pass. Commit.**

---

## Task 2: Form-validation logic TDD

**Files:**
- Create: `lib/admin/validate-map.ts`
- Create: `tests/unit/validate-map.test.ts`

Pure logic, fully unit-testable. Tests cover:

- All three wrong answers required.
- Year != 0; no wrong answer == 0.
- No duplicate (sign-converted) values across `correct` + 3 wrong.
- Reveal text non-empty.
- Title non-empty, max length (e.g. 200 chars).
- Precision in `["century", "decade", "year"]`.
- Difficulty in `["easy", "medium", "hard"]` if provided.
- Tags is an array of strings, all from a predefined `TAG_LIST`.

```ts
export const TAG_LIST = [
  "europe", "africa", "americas", "asia", "southeast-asia",
  "ancient", "medieval", "early-modern", "modern",
  "crusades", "decolonization", "napoleonic", "cold-war",
] as const;

export type Tag = (typeof TAG_LIST)[number];

export interface MapFormInput { /* shape mirrors the form */ }
export type MapValidationResult =
  | { ok: true; clean: ValidatedMap }
  | { ok: false; errors: Partial<Record<keyof MapFormInput, string>> };

export function validateMapForm(input: MapFormInput): MapValidationResult {
  /* implement to satisfy each failing test in turn */
}
```

Commit per test or batch. Final commit:
```
git commit -m "feat(admin): map-form validation with tag whitelist + duplicate detection"
```

---

## Task 3: `createMap` Server Action TDD

**Files:**
- Modify: `app/(admin)/actions.ts`
- Create: `tests/integration/create-map.test.ts`

Integration test (against TEST branch):
- Sign in as curator. Call `createMap` with valid input. Assert: returns `{ ok: true, mapId }`. Re-query the map row, verify all columns are populated correctly (formatted_correct/wrong via formatAnswer, geojson_data has stripped + colored features, created_by matches curator).
- Sign in as curator. Call `createMap` with `correct_year: 0`. Assert: returns `{ ok: false, errors: { correct_year: ... } }` and no row was inserted.
- Sign in as curator. Call `createMap` with duplicate wrong answers. Assert validation error.

Implementation runs validate → preview pipeline → format → insert.

```ts
export async function createMap(input: MapFormInput): Promise<CreateMapResult> {
  const validation = validateMapForm(input);
  if (!validation.ok) return { ok: false, errors: validation.errors };

  const { correct_year, precision, wrong_answers } = validation.clean;

  // Pre-storage pipeline.
  const all = await loadCliopatria();
  const filtered = filterByYear(all.features, correct_year);
  if (filtered.length === 0) {
    return { ok: false, errors: { correct_year: "no entities at this year" } };
  }
  const stripped = stripYearData(filtered);
  const colored = assignColors(stripped);

  // formatAnswer pre-computation.
  const formatted_correct = formatAnswer(correct_year, precision);
  const formatted_wrong = wrong_answers.map((y) => formatAnswer(y, precision));

  // Resolve session and insert via getServerSupabase.
  const supabase = await getServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, errors: { _form: "not authenticated" } };

  const { data, error } = await supabase
    .from("maps")
    .insert({
      title: validation.clean.title,
      geojson_data: { type: "FeatureCollection", features: colored },
      correct_year,
      precision,
      wrong_answers,
      formatted_correct,
      formatted_wrong,
      center_lat: validation.clean.center_lat,
      center_lng: validation.clean.center_lng,
      zoom_level: validation.clean.zoom_level,
      reveal_text: validation.clean.reveal_text,
      difficulty: validation.clean.difficulty ?? "medium",
      tags: validation.clean.tags ?? [],
      created_by: user.id,
    })
    .select("id")
    .single();
  if (error) return { ok: false, errors: { _form: error.message } };
  return { ok: true, mapId: data.id };
}
```

Commit:
```
git commit -m "feat(admin): createMap server action runs full storage pipeline"
```

---

## Task 4: Creation form Client Component

**Files:**
- Create: `app/(admin)/admin/create/page.tsx` (Server Component shell)
- Create: `app/(admin)/admin/create/CreateMapForm.tsx` (Client Component)

Layout follows the architecture's three steps:
1. Year input + AD/BC toggle + "Preview" button → fires `previewMap(year)`.
2. After preview loads, render `MapViewer` (Phase 8) inside the form. Pan/zoom captures `center_lat`, `center_lng`, `zoom_level`.
3. Metadata fields: title, precision dropdown, three wrong-answer rows (each with AD/BC toggle), reveal text textarea, optional difficulty + tags.

Validation on the client mirrors `validateMapForm` so errors show inline before round-tripping. Submit button disabled until validation passes.

Component tests:
- Year input + preview round trip renders the map.
- Validation errors appear inline on bad input.
- Successful submit redirects to `/admin` with the new map showing.

Commit progressively:
```
git commit -m "feat(admin): create-map form — year + preview"
git commit -m "feat(admin): create-map form — viewport framing"
git commit -m "feat(admin): create-map form — metadata + submit"
```

---

## Task 5: E2E test for creation flow

**Files:**
- Create: `tests/e2e/admin-create-map.spec.ts`

Covers:
- Curator signs in (using the existing helper or repeating the login-form interaction), visits `/admin/create`, enters year `1815`, clicks Preview, sees the map render, fills metadata, submits, lands on `/admin` with the new map listed.
- Curator with malformed input (e.g. duplicate wrong answers) sees inline errors and submit stays disabled.

Commit:
```
git commit -m "test(e2e): admin create-map happy + validation paths"
```

---

## Verification before merge

- Unit tests (validation): all pass.
- Integration tests (`previewMap`, `createMap`): all pass against TEST.
- E2E: all pass (3 from Phase 5 + 2 new = 5).
- `tsc`, lint, build clean.
- Manual local: log in as curator on the live preview, create a map, see it land.

## Merge

```
git checkout main
git merge --no-ff phase/9-map-creation-flow -m "merge: phase 9 — curator map creation, end to end"
git push origin main
```

After merge, real maps live in the database. Phase 10 surfaces them in management; Phase 11+12 plays them.
