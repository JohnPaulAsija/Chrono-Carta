# Phase 10 — Map Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** A real map list view replacing the empty-state placeholder, an edit page that pre-fills the same form Phase 9 built, and a deactivate Server Action that sets `active = false`. RLS handles the curator-vs-admin scope automatically.

**Architecture:** Per architecture §Map Management View. Curators see their own maps; admins see all (RLS handles both via the policies from Phase 2 + the `users_admin_read` Phase-3 follow-up). Edits run the same `createMap` storage pipeline (re-filter Cliopatria, re-color, re-run `formatAnswer`) when `correct_year` changes; otherwise just re-run `formatAnswer` and update.

**Tech Stack:** Same as Phase 9. Tests cover RLS-narrowed list, edit happy path, deactivate effect.

---

## Task 1: List view replacing the empty-state

**Files:**
- Modify: `app/(admin)/admin/page.tsx`

**Step 1: Failing component test.**

A new component test asserts:
- The page renders one row per `maps` row that the current user can see (mocked Supabase response).
- Each row shows title, correct_year (formatted via formatAnswer), precision, active status, created_at.
- Each row has an Edit link to `/admin/edit/[id]`.

**Step 2: Implement.** Replace the empty-state block with a table:

```tsx
{maps.length === 0 ? (
  <EmptyState />
) : (
  <table>
    <thead>{/* ... */}</thead>
    <tbody>
      {maps.map((m) => (
        <tr key={m.id}>
          <td>{m.title}</td>
          <td>{m.formatted_correct}</td>
          <td>{m.precision}</td>
          <td>{m.active ? "Active" : "Inactive"}</td>
          <td><Link href={`/admin/edit/${m.id}`}>Edit</Link></td>
          <td>
            <form action={async () => { "use server"; await deactivateMap(m.id); }}>
              <button type="submit" disabled={!m.active}>Deactivate</button>
            </form>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)}
```

Update the `select` columns: `select("id, title, correct_year, precision, formatted_correct, active, created_at")`.

Commit:
```
git commit -m "feat(admin): real map list table replaces empty-state placeholder"
```

---

## Task 2: `deactivateMap(id)` Server Action TDD

**Files:**
- Modify: `app/(admin)/actions.ts`
- Create: `tests/integration/deactivate-map.test.ts`

Tests:
- Curator can deactivate their own map (active flips to false).
- Curator CANNOT deactivate another curator's map (RLS no-op, the row is unchanged via service-role re-read).
- Admin can deactivate any map.

Implementation:
```ts
export async function deactivateMap(id: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = await getServerSupabase();
  const { error } = await supabase
    .from("maps")
    .update({ active: false })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

Commit:
```
git commit -m "feat(admin): deactivateMap with RLS-bound update"
```

---

## Task 3: Edit page — `/admin/edit/[id]`

**Files:**
- Create: `app/(admin)/admin/edit/[id]/page.tsx` (Server Component shell)
- Modify: `app/(admin)/admin/create/CreateMapForm.tsx` to accept optional `initial: MapFormInput` prop, rename to `MapForm` if reused.

Server Component reads the map row by id (RLS-narrowed), runs `requireUserProfile`, renders the form with initial values populated. Submit calls a new `updateMap(id, input)` Server Action.

Commit incrementally:
```
git commit -m "refactor(admin): rename CreateMapForm to MapForm, accept initial values"
git commit -m "feat(admin): edit page reads map by id and pre-fills form"
```

---

## Task 4: `updateMap(id, input)` Server Action TDD

**Files:**
- Modify: `app/(admin)/actions.ts`
- Create: `tests/integration/update-map.test.ts`

Tests:
- Updating non-year metadata (title, reveal_text, difficulty, tags) writes those columns and re-runs `formatAnswer` only.
- Updating `correct_year` re-runs the full pipeline (filter → strip → color → format) and rewrites `geojson_data`.
- Updating `precision` re-runs `formatAnswer` for both correct + wrongs.
- Curator cannot update another curator's map (RLS).

Implementation gates the expensive recompute on whether `correct_year` changed compared to the existing row.

Commit:
```
git commit -m "feat(admin): updateMap re-runs the storage pipeline only when correct_year changes"
```

---

## Task 5: E2E for management

**Files:**
- Create: `tests/e2e/admin-management.spec.ts`

Three scenarios:
- Curator signs in, lands on /admin, sees the seeded test map (assumes Phase 9 created at least one), clicks Edit, changes the title, saves, sees the updated title in the list.
- Curator deactivates a map; row updates to show "Inactive".
- Admin signs in, sees maps from other curators in the list (cross-user via the admin policy).

Commit:
```
git commit -m "test(e2e): map management — list, edit, deactivate, admin cross-user"
```

---

## Verification

All tests pass; build clean.

## Merge

```
git checkout main
git merge --no-ff phase/10-map-management -m "merge: phase 10 — list, edit, deactivate"
git push origin main
```
