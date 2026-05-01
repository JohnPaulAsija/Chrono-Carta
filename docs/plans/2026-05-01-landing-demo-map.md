# Landing Demo Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the default Next.js landing page with an interactive demo of the existing map viewer, gated by a small dropdown of three curated historical years (AD 117, AD 1812, AD 1919), so the project has something visually demonstrable while the v1 game flow is still in development.

**Architecture:** Server Component reads `?year=<value>` from `searchParams`, loads/filters/strips/colors the Cliopatria dataset on the server, and renders the existing `MapPanel` client component. A small `<YearPicker>` client component updates the URL via `router.push`, triggering server re-render with the cached dataset (subsequent renders are fast — only first hit pays the ~180 MB JSON parse cost). No new dependencies; all data utilities and rendering primitives already exist.

**Tech Stack:** Next.js 16 App Router (Server Components + searchParams), React 19, existing `lib/cliopatria.ts`, `lib/map-colors.ts`, `app/(game)/play/MapPanel.tsx`, Jest + RTL for tests.

**Note on scope:** This is an explicit, tracked deviation from the architecture doc, which calls for the root path to be the gameplay start screen. The deviation is temporary and intentional — see "Architecture doc update" task below. The page that replaces this in v1 lives in [chrono-carta-architecture.md](../../chrono-carta-architecture.md).

**Branch:** `feat/landing-demo-map` (already created)

**WIP recovery:** A first-draft implementation is preserved as a `git stash` entry titled `wip: landing demo map (pre-plan draft)`. Can be inspected with `git stash show -p stash@{0}` for reference, but the plan rebuilds the work from scratch with tests, so the stash should be **dropped** at the end (`git stash drop stash@{0}`) rather than popped.

---

## Task 1: Demo-year constants module

**Why a separate module:** Keeps the page thin, makes the year list testable without rendering, and gives a single source of truth for the value/label/caption mapping that both the server page and the client picker reference.

**Files:**
- Create: `lib/demo-years.ts`
- Create: `tests/unit/demo-years.test.ts`

**Step 1: Write the failing test**

```ts
// tests/unit/demo-years.test.ts
import { DEMO_YEARS, findDemoYear, DEFAULT_DEMO_YEAR } from "../../lib/demo-years";

describe("demo-years", () => {
  it("exposes exactly the three curated years in chronological order", () => {
    expect(DEMO_YEARS.map((d) => d.year)).toEqual([117, 1812, 1919]);
  });

  it("each entry has a non-empty label and caption", () => {
    for (const d of DEMO_YEARS) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.caption.length).toBeGreaterThan(0);
      expect(d.value).toMatch(/^-?\d+$/);
    }
  });

  it("findDemoYear returns the matching entry by value", () => {
    expect(findDemoYear("1812")?.year).toBe(1812);
  });

  it("findDemoYear returns undefined for an unknown value", () => {
    expect(findDemoYear("9999")).toBeUndefined();
    expect(findDemoYear(undefined)).toBeUndefined();
  });

  it("DEFAULT_DEMO_YEAR is the first entry", () => {
    expect(DEFAULT_DEMO_YEAR).toBe(DEMO_YEARS[0]);
  });
});
```

**Step 2: Run test — expect failure**

Run: `npx jest --selectProjects unit tests/unit/demo-years.test.ts`
Expected: FAIL with `Cannot find module '../../lib/demo-years'`.

**Step 3: Implement `lib/demo-years.ts`**

```ts
export interface DemoYear {
  /** URL-safe string form of the year (signed integer, no zero). */
  value: string;
  /** Signed integer year — positive AD, negative BC. */
  year: number;
  /** Dropdown label. */
  label: string;
  /** Sub-header caption shown when this year is selected. */
  caption: string;
}

export const DEMO_YEARS: readonly DemoYear[] = [
  {
    value: "117",
    year: 117,
    label: "AD 117 — Height of Rome",
    caption: "The Roman Empire at its greatest extent under Trajan.",
  },
  {
    value: "1812",
    year: 1812,
    label: "AD 1812 — Height of Napoleon",
    caption: "Napoleonic Europe on the eve of the Russian campaign.",
  },
  {
    value: "1919",
    year: 1919,
    label: "AD 1919 — Height of the British Empire",
    caption: "The British Empire at its post-WWI territorial peak.",
  },
] as const;

export const DEFAULT_DEMO_YEAR: DemoYear = DEMO_YEARS[0]!;

export function findDemoYear(value: string | undefined): DemoYear | undefined {
  if (value === undefined) return undefined;
  return DEMO_YEARS.find((d) => d.value === value);
}
```

**Step 4: Run test — expect pass**

Run: `npx jest --selectProjects unit tests/unit/demo-years.test.ts`
Expected: PASS, 5/5.

**Step 5: Commit**

```bash
git add lib/demo-years.ts tests/unit/demo-years.test.ts
git commit -m "feat(demo): add curated demo-year constants module"
```

---

## Task 2: `<YearPicker>` client component

**Why a Client Component:** It owns the `<select>` and calls `useRouter().push` on change. It is the *only* client-side surface added by this work — page-level state stays server-driven via the URL.

**Files:**
- Create: `app/(game)/YearPicker.tsx`
- Create: `tests/unit/YearPicker.test.tsx`

**Step 1: Write the failing test**

```tsx
// tests/unit/YearPicker.test.tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { YearPicker } from "../../app/(game)/YearPicker";

const pushMock = jest.fn();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const options = [
  { value: "117", label: "AD 117" },
  { value: "1812", label: "AD 1812" },
  { value: "1919", label: "AD 1919" },
];

beforeEach(() => {
  pushMock.mockReset();
});

describe("YearPicker", () => {
  it("renders one <option> per provided option", () => {
    render(<YearPicker options={options} selected="117" />);
    expect(screen.getAllByRole("option")).toHaveLength(3);
  });

  it("marks the selected option as the current value", () => {
    render(<YearPicker options={options} selected="1812" />);
    expect(screen.getByRole("combobox")).toHaveValue("1812");
  });

  it("pushes ?year=<value> when the user picks a different year", async () => {
    const user = userEvent.setup();
    render(<YearPicker options={options} selected="117" />);
    await user.selectOptions(screen.getByRole("combobox"), "1919");
    expect(pushMock).toHaveBeenCalledWith("/?year=1919");
  });
});
```

**Step 2: Run test — expect failure**

Run: `npx jest --selectProjects unit tests/unit/YearPicker.test.tsx`
Expected: FAIL with `Cannot find module '../../app/(game)/YearPicker'`.

**Step 3: Implement `app/(game)/YearPicker.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export interface YearPickerOption {
  value: string;
  label: string;
}

export interface YearPickerProps {
  options: YearPickerOption[];
  selected: string;
}

export function YearPicker({ options, selected }: YearPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">Year:</span>
      <select
        value={selected}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => {
            router.push(`/?year=${encodeURIComponent(next)}`);
          });
        }}
        className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {isPending ? <span className="text-zinc-500">loading…</span> : null}
    </label>
  );
}
```

**Step 4: Run test — expect pass**

Run: `npx jest --selectProjects unit tests/unit/YearPicker.test.tsx`
Expected: PASS, 3/3.

**Step 5: Commit**

```bash
git add app/(game)/YearPicker.tsx tests/unit/YearPicker.test.tsx
git commit -m "feat(demo): add YearPicker client component"
```

---

## Task 3: Wire the landing page to render the demo

**Files:**
- Modify: `app/(game)/page.tsx` (currently the default Next.js template — full rewrite)

**No unit test here.** `page.tsx` is a thin Server Component composition that depends on filesystem I/O and Next-internal `searchParams`. The behavior it adds beyond Tasks 1–2 is wiring; it is verified by the dev-server smoke check in Task 4. Adding a Jest test for it would require mocking the filesystem, the router context, and the dataset — high cost, low signal. We accept that the smoke test is the spec.

**Step 1: Replace `app/(game)/page.tsx`**

```tsx
import {
  loadCliopatria,
  filterByYear,
  stripYearData,
} from "@/lib/cliopatria";
import { assignColors } from "@/lib/map-colors";
import { DEMO_YEARS, DEFAULT_DEMO_YEAR, findDemoYear } from "@/lib/demo-years";
import type { MapFeatureCollection } from "./play/types";
import { MapPanel } from "./play/MapPanel";
import { YearPicker, type YearPickerOption } from "./YearPicker";

const PICKER_OPTIONS: YearPickerOption[] = DEMO_YEARS.map((d) => ({
  value: d.value,
  label: d.label,
}));

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const selected = findDemoYear(yearParam) ?? DEFAULT_DEMO_YEAR;

  const dataset = await loadCliopatria();
  const filtered = filterByYear(dataset.features, selected.year);
  const stripped = stripYearData(filtered);
  const colored = assignColors(stripped);

  const geojson: MapFeatureCollection = {
    type: "FeatureCollection",
    features: colored,
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            ChronoCarta — Demo
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {selected.caption}
          </p>
        </div>
        <YearPicker options={PICKER_OPTIONS} selected={selected.value} />
      </header>
      <MapPanel geojson={geojson} />
    </div>
  );
}
```

**Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean exit (no errors).

**Step 3: Lint**

Run: `npm run lint`
Expected: clean.

**Step 4: Run all unit tests**

Run: `npm run test:unit`
Expected: all green, including the two new test files from Tasks 1–2.

**Step 5: Commit**

```bash
git add app/(game)/page.tsx
git commit -m "feat(demo): render demo map viewer on landing page"
```

---

## Task 4: Manual smoke test in the dev server

**Why manual:** Per CLAUDE.md, UI features must be verified in a browser before being claimed complete. Type checks and unit tests don't catch viewport bugs, projection issues, or color-assignment regressions on the real ~180 MB dataset.

**Step 1: Start the dev server**

Run: `npm run dev`
Wait for `Ready in <ms>` line.

**Step 2: Verify default year (AD 117)**

- Open `http://localhost:3000/` in a browser.
- First load may take several seconds (cold Cliopatria parse).
- Confirm:
  - Header reads "ChronoCarta — Demo".
  - Caption mentions Trajan.
  - Map renders a coloured Roman empire across the Mediterranean.
  - Dropdown shows the three options, with "AD 117 — Height of Rome" selected.
  - DevTools → Network → the page document response: GeoJSON features only carry `Name`, optional `MemberOf`, `color`, and `geometry`. No `FromYear`/`ToYear`/`Wikipedia`/etc. (Per architecture invariant 2.)

**Step 3: Switch to AD 1812**

- Pick "AD 1812 — Height of Napoleon".
- URL updates to `/?year=1812`.
- Map re-renders with the Napoleonic configuration; caption changes.
- Subsequent year switches feel snappy (cached dataset).

**Step 4: Switch to AD 1919**

- Pick "AD 1919 — Height of the British Empire".
- URL updates to `/?year=1919`.
- Map re-renders; the British Empire's territorial peak is visible (large pink/orange-toned coverage across continents).

**Step 5: Defensive route check**

- Navigate to `http://localhost:3000/?year=junk`.
- Expected: page falls back to AD 117 silently (the default).

**Step 6: Mobile viewport**

- DevTools → toggle device toolbar → 375 px width.
- The page is **not** required to look good below 768 px (per architecture invariant 7), but verify the page does not crash. Out of scope to add a small-screen guard for the demo — the gameplay-route guard from later phases will cover this when the gameplay flow lands here.

**Step 7: Stop the server (Ctrl+C) and commit nothing.** This task produces no code changes.

---

## Task 5: Architecture doc update

**Why:** Per CLAUDE.md, drift between the doc and code is a bug. The architecture doc says the root path is the gameplay start screen. Document the temporary deviation in the same PR.

**Files:**
- Modify: `chrono-carta-architecture.md`

**Step 1: Read the current architecture doc** to find where it describes the landing/start-screen route.

Run: `npx grep -n "start screen\|landing\|root path\|/$" chrono-carta-architecture.md` (or open the file and search).

**Step 2: Add a short "Temporary state" note** near that section. Suggested wording:

> **Temporary state (as of 2026-05-01):** Until the gameplay start screen lands, `app/(game)/page.tsx` renders a three-year demo of the map viewer (AD 117, AD 1812, AD 1919), driven by a `?year=` query param. See [docs/plans/2026-05-01-landing-demo-map.md](docs/plans/2026-05-01-landing-demo-map.md). This route will be replaced when the gameplay UI phase begins; the demo and `<YearPicker>` are expected to be deleted at that point — they are not a public surface to preserve.

**Step 3: Add a follow-up entry** in the "Pending Follow-Ups" section of `CLAUDE.md`:

> - **Remove landing-page demo** — `app/(game)/page.tsx` and `app/(game)/YearPicker.tsx` are a temporary demo (introduced 2026-05-01) and must be deleted when the gameplay start screen is implemented in the gameplay-UI phase. The `lib/demo-years.ts` constants module is also expected to go.

**Step 4: Commit**

```bash
git add chrono-carta-architecture.md CLAUDE.md
git commit -m "docs: flag landing-page demo as temporary deviation"
```

---

## Wrap-up

**Verify the branch story reads cleanly:**

Run: `git log --oneline main..HEAD`
Expected:
```
<sha> docs: flag landing-page demo as temporary deviation
<sha> feat(demo): render demo map viewer on landing page
<sha> feat(demo): add YearPicker client component
<sha> feat(demo): add curated demo-year constants module
```

**Drop the pre-plan stash** (it has been superseded by the committed work):

Run: `git stash list` (confirm `stash@{0}` is the `wip: landing demo map (pre-plan draft)` entry)
Run: `git stash drop stash@{0}`

**Open a PR** when satisfied. Title: `feat(demo): landing-page map viewer demo (temporary)`. Body should call out:
- This is a tracked deviation from the architecture doc (link the doc note).
- The three commits each stand alone and pass tests/lint individually.
- Includes manual smoke-test notes for the reviewer to repeat.

---

## Skills referenced

- @superpowers:test-driven-development — Tasks 1 and 2 follow strict red-green TDD.
- @superpowers:verification-before-completion — Task 4 is the verification gate before claiming done.
- @superpowers:executing-plans — recommended driver for this plan.
