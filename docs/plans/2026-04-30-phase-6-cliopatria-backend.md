# Phase 6 — Cliopatria Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. The TDD steps below assume superpowers:test-driven-development discipline.

**Goal:** Stand up `lib/cliopatria.ts` so the rest of v1 can read polities at a year and ship a stripped, gameplay-safe GeoJSON snapshot. No UI in this phase — pure logic, fully unit-tested.

**Architecture:** The Cliopatria GeoJSON file (50–100 MB) lives at `public/data/cliopatria.geojson` on the server filesystem. `loadCliopatria()` reads and parses it once on first call, caches in module-level memory for the process lifetime. `filterByYear(year)` returns features where `FromYear ≤ year ≤ ToYear`. `stripYearData(features)` removes the leak-prone fields per architecture §Preprocessing and Storage. The dataset is too large to commit; a download script fetches it during `npm install`.

**Tech Stack:** TypeScript, Node `fs/promises`, no new runtime deps. Test fixtures live in `tests/fixtures/cliopatria-mini.geojson` so unit tests run in milliseconds without touching the real dataset.

---

## Task 1: Wire the dataset into the install flow

**Files:**
- Create: `scripts/download-cliopatria.mjs`
- Modify: `package.json` (add `postinstall` + dependency-free download script)
- Modify: `.gitignore` (ignore `public/data/cliopatria.geojson`)
- Create: `public/data/.gitkeep` if not present

**Step 1: Add the download script.**

```js
// scripts/download-cliopatria.mjs
import { createWriteStream, existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";

const URL =
  "https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/main/world.geojson";
const DEST = "public/data/cliopatria.geojson";

if (existsSync(DEST)) {
  console.log(`[cliopatria] already present at ${DEST}, skipping download.`);
  process.exit(0);
}

await mkdir(dirname(DEST), { recursive: true });
console.log(`[cliopatria] downloading from ${URL}`);
const response = await fetch(URL);
if (!response.ok || !response.body) {
  console.error(`[cliopatria] download failed: ${response.status}`);
  process.exit(1);
}
await pipeline(response.body, createWriteStream(DEST));
console.log(`[cliopatria] wrote ${DEST}`);
```

Confirm the canonical Cliopatria URL before pasting — the URL above is illustrative; check the Seshat repo for the actual filename.

**Step 2: Update `package.json` scripts.**

Add to `scripts`:
```json
"postinstall": "node scripts/download-cliopatria.mjs",
"data:fetch": "node scripts/download-cliopatria.mjs"
```

**Step 3: Gitignore the dataset.**

Add to `.gitignore`:
```
# Cliopatria dataset — too large to commit; downloaded by postinstall
public/data/cliopatria.geojson
```

**Step 4: Run the script and confirm.**

```
npm run data:fetch
ls -la public/data/cliopatria.geojson
```

Expect: a 50–100 MB file present.

**Step 5: Commit.**

```
git add scripts/download-cliopatria.mjs package.json package-lock.json .gitignore
git commit -m "chore(data): cliopatria dataset download script + postinstall hook"
```

---

## Task 2: Test fixture for unit tests

**Files:**
- Create: `tests/fixtures/cliopatria-mini.geojson` (~10 hand-curated features spanning a few year ranges)

**Step 1: Build a small fixture covering edge cases.**

Five features minimum, with year ranges chosen so tests exercise:
- a feature that's active in the queried year (the basic include case)
- a feature whose `ToYear` equals the queried year (boundary inclusive)
- a feature whose `FromYear` equals the queried year (boundary inclusive)
- a feature that's strictly outside (exclude)
- a feature with `MemberOf` set (for color-family work in Phase 8 — out of scope here but the fixture covers it now)

Each feature carries `Name`, `geometry` (any valid Polygon — coordinates can be made-up), `FromYear`, `ToYear`, and optional `MemberOf`, `Wikipedia`, `SeshatID`, `Type`, `Components`, `Area` so the strip step has things to remove.

**Step 2: Commit.**

```
git add tests/fixtures/cliopatria-mini.geojson
git commit -m "test(fixtures): cliopatria-mini geojson covering filter + strip edges"
```

---

## Task 3: `loadCliopatria()` with a failing test first

**Files:**
- Create: `tests/unit/cliopatria.test.ts`
- Create: `lib/cliopatria.ts`

**Step 1: Write the failing test.**

```ts
import { loadCliopatria } from "@/lib/cliopatria";

describe("loadCliopatria", () => {
  it("returns the parsed FeatureCollection from disk", async () => {
    const fc = await loadCliopatria("tests/fixtures/cliopatria-mini.geojson");
    expect(fc.type).toBe("FeatureCollection");
    expect(Array.isArray(fc.features)).toBe(true);
    expect(fc.features.length).toBeGreaterThan(0);
  });

  it("caches the parsed result across calls", async () => {
    const a = await loadCliopatria("tests/fixtures/cliopatria-mini.geojson");
    const b = await loadCliopatria("tests/fixtures/cliopatria-mini.geojson");
    expect(b).toBe(a);
  });
});
```

**Step 2: Run, watch fail.**

```
npm test -- --selectProjects unit -t "loadCliopatria"
```

Expected: `Cannot find module '@/lib/cliopatria'`.

**Step 3: Implement minimal version.**

```ts
// lib/cliopatria.ts
import { readFile } from "node:fs/promises";

export interface CliopatriaFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: {
    Name: string;
    FromYear: number;
    ToYear: number;
    MemberOf?: string;
    [k: string]: unknown;
  };
}
export interface CliopatriaFeatureCollection {
  type: "FeatureCollection";
  features: CliopatriaFeature[];
}

let cache: CliopatriaFeatureCollection | null = null;
let cachedPath: string | null = null;

const DEFAULT_PATH = "public/data/cliopatria.geojson";

export async function loadCliopatria(
  path: string = DEFAULT_PATH,
): Promise<CliopatriaFeatureCollection> {
  if (cache && cachedPath === path) {
    return cache;
  }
  const raw = await readFile(path, "utf8");
  const parsed = JSON.parse(raw) as CliopatriaFeatureCollection;
  cache = parsed;
  cachedPath = path;
  return parsed;
}

// Test-only helper. Resets the module-level cache so each test starts
// from a clean state.
export function _resetCliopatriaCache(): void {
  cache = null;
  cachedPath = null;
}
```

**Step 4: Reset cache in test setup.**

Add to top of the describe block:
```ts
import { _resetCliopatriaCache } from "@/lib/cliopatria";
beforeEach(() => _resetCliopatriaCache());
```

**Step 5: Run, watch pass.**

```
npm test -- --selectProjects unit -t "loadCliopatria"
```

Expected: 2 passed.

**Step 6: Commit.**

```
git add lib/cliopatria.ts tests/unit/cliopatria.test.ts
git commit -m "feat(cliopatria): loadCliopatria with module-level cache"
```

---

## Task 4: `filterByYear(year)` TDD

**Files:**
- Modify: `tests/unit/cliopatria.test.ts`
- Modify: `lib/cliopatria.ts`

**Step 1: Add failing tests.**

```ts
describe("filterByYear", () => {
  it("includes a feature whose range spans the year", async () => {
    const fc = await loadCliopatria("tests/fixtures/cliopatria-mini.geojson");
    const result = filterByYear(fc.features, /* year known to overlap */);
    expect(result.map((f) => f.properties.Name)).toContain(/* known name */);
  });

  it("includes features at the inclusive lower bound (FromYear === year)", () => {
    /* test boundary inclusivity */
  });

  it("includes features at the inclusive upper bound (ToYear === year)", () => {
    /* test boundary inclusivity */
  });

  it("excludes features outside the range", () => {
    /* test exclusion */
  });

  it("returns an empty array when no features overlap", () => {
    expect(filterByYear([], 1815)).toEqual([]);
  });
});
```

Replace the `/* ... */` placeholders with concrete years/names from your fixture.

**Step 2: Run, watch fail.** `Cannot find name 'filterByYear'`.

**Step 3: Implement.**

```ts
export function filterByYear(
  features: CliopatriaFeature[],
  year: number,
): CliopatriaFeature[] {
  return features.filter(
    (f) => f.properties.FromYear <= year && year <= f.properties.ToYear,
  );
}
```

**Step 4: Run, watch pass.**

**Step 5: Commit.**

```
git add tests/unit/cliopatria.test.ts lib/cliopatria.ts
git commit -m "feat(cliopatria): filterByYear with inclusive boundaries"
```

---

## Task 5: `stripYearData(features)` TDD

**Files:**
- Modify: `tests/unit/cliopatria.test.ts`
- Modify: `lib/cliopatria.ts`

**Step 1: Add failing tests.**

```ts
describe("stripYearData", () => {
  it("preserves Name, geometry, MemberOf", () => {
    const stripped = stripYearData([{
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      properties: {
        Name: "Test",
        FromYear: 1800,
        ToYear: 1900,
        MemberOf: "Holy Roman Empire",
        Area: 12345,
        Wikipedia: "https://en.wikipedia.org/wiki/Test",
        SeshatID: "abc",
        Type: "Polity",
        Components: ["a", "b"],
      },
    }]);
    expect(stripped[0].properties).toEqual({
      Name: "Test",
      MemberOf: "Holy Roman Empire",
    });
    expect(stripped[0].geometry).toBeDefined();
  });

  it("drops FromYear, ToYear, Area, Wikipedia, SeshatID, Type, Components", () => {
    /* every leak-prone field is gone */
  });

  it("omits MemberOf when the feature has none", () => {
    /* preserves shape: only present when present */
  });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.**

```ts
export interface StrippedFeature {
  type: "Feature";
  geometry: GeoJSON.Geometry;
  properties: {
    Name: string;
    MemberOf?: string;
  };
}

export function stripYearData(
  features: CliopatriaFeature[],
): StrippedFeature[] {
  return features.map((f) => {
    const props: StrippedFeature["properties"] = { Name: f.properties.Name };
    if (typeof f.properties.MemberOf === "string") {
      props.MemberOf = f.properties.MemberOf;
    }
    return {
      type: "Feature",
      geometry: f.geometry,
      properties: props,
    };
  });
}
```

**Step 4: Run, watch pass.**

**Step 5: Commit.**

```
git add tests/unit/cliopatria.test.ts lib/cliopatria.ts
git commit -m "feat(cliopatria): stripYearData drops year + auxiliary fields"
```

---

## Task 6: Smoke test against the real dataset

The unit tests use the mini fixture for speed. One additional test confirms the real dataset parses.

**Step 1: Add the smoke test (skipped if file is absent so CI doesn't break before postinstall has run).**

```ts
import { existsSync } from "node:fs";

const realDatasetPresent = existsSync("public/data/cliopatria.geojson");
const describeWithRealDataset = realDatasetPresent ? describe : describe.skip;

describeWithRealDataset("real cliopatria dataset", () => {
  it("parses without error and contains thousands of features", async () => {
    const fc = await loadCliopatria();
    expect(fc.features.length).toBeGreaterThan(1000);
  });

  it("filterByYear(1815) returns a non-empty subset", async () => {
    const fc = await loadCliopatria();
    expect(filterByYear(fc.features, 1815).length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run.**

```
npm test -- --selectProjects unit -t "real cliopatria dataset"
```

Expected: passes locally (where the dataset is present), skipped if missing.

**Step 3: Commit.**

```
git add tests/unit/cliopatria.test.ts
git commit -m "test(cliopatria): smoke test against real dataset, skipped when absent"
```

---

## Task 7: Wire postinstall into CI

**Files:**
- Modify: `.github/workflows/ci.yml`

**Step 1: Cache the dataset between runs to avoid re-downloading every CI run.**

Add a cache step before `npm ci`:
```yaml
      - name: Cache Cliopatria dataset
        uses: actions/cache@v4
        with:
          path: public/data/cliopatria.geojson
          key: cliopatria-${{ hashFiles('scripts/download-cliopatria.mjs') }}
```

`npm ci` will trigger the postinstall, which is a no-op when the file is present.

**Step 2: Run CI locally if `act` is installed, or push the branch and watch.**

**Step 3: Commit.**

```
git add .github/workflows/ci.yml
git commit -m "ci: cache cliopatria dataset across runs"
```

---

## Task 8: Architecture doc + plan deviations

**Files:**
- Modify: `chrono-carta-architecture.md` if any concrete detail (file path, function signatures) differs from what the doc says.
- Modify: `docs/plans/2026-04-29-project-bootstrap.md` deviations section if a deviation occurred.

Most likely no doc change needed — the architecture is already specific about Cliopatria.

**Commit if any:**

```
git add chrono-carta-architecture.md docs/plans/2026-04-29-project-bootstrap.md
git commit -m "docs(arch): update cliopatria section to match phase-6 implementation"
```

---

## Verification before merge

- `npm test -- --selectProjects unit` → all green
- `npx tsc --noEmit` → clean
- `npm run lint` → clean
- `npm run build` → clean (build runs postinstall implicitly via `npm ci`)
- `git status` → clean

## Merge

```
git checkout main
git merge --no-ff phase/6-cliopatria-backend -m "merge: phase 6 — cliopatria loader, filter, strip"
git push origin main
```

Watch CI. Production deploy will rebuild but no behavior change yet — the new code is library-only.
