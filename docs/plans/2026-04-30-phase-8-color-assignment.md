# Phase 8 — Color Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. TDD discipline per superpowers:test-driven-development for each task below.

**Goal:** `lib/map-colors.ts` exporting `assignColors(features)` so map creation can annotate every feature with a stable, distinct, family-aware color before storing the map.

**Architecture:** Per architecture §Color Assignment. Two responsibilities: (1) compute polygon adjacency from geometries (which polygons share a border), (2) apply a graph-coloring pass that lays out colors across the adjacency graph using a small palette (8–12 colors) while keeping `MemberOf`-related polygons in the same hue family. Result: every feature gets a `color` property that the client renders directly with no further computation.

**Tech Stack:** `@turf/turf` for polygon adjacency (specifically `booleanIntersects` or `booleanContains`). Pure TypeScript graph coloring via greedy DSatur-style algorithm. Unit-tested with hand-built fixtures.

---

## Task 1: Install Turf

**Files:** `package.json`, `package-lock.json`.

**Step 1:** `npm i @turf/turf`. Adds runtime dep — used both by `lib/map-colors.ts` (Phase 8) and potentially `lib/cliopatria.ts` future filtering.

**Step 2:** Commit.

```
git add package.json package-lock.json
git commit -m "chore: add @turf/turf for geometry primitives"
```

---

## Task 2: Adjacency graph TDD

**Files:**
- Create: `tests/unit/map-colors.test.ts`
- Create: `lib/map-colors.ts`

**Step 1: Write a failing test.**

Use four hand-built squares: A and B share an edge, B and C share an edge, C and D share an edge, A and D do not. Expected adjacency: `{A: [B], B: [A, C], C: [B, D], D: [C]}`.

```ts
import { computeAdjacency } from "@/lib/map-colors";
import type { StrippedFeature } from "@/lib/cliopatria";

function square(name: string, originX: number, originY: number): StrippedFeature {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [[
        [originX, originY], [originX + 1, originY],
        [originX + 1, originY + 1], [originX, originY + 1],
        [originX, originY],
      ]],
    },
    properties: { Name: name },
  };
}

describe("computeAdjacency", () => {
  it("identifies polygons sharing a border", () => {
    const A = square("A", 0, 0);
    const B = square("B", 1, 0);
    const C = square("C", 2, 0);
    const D = square("D", 3, 0);
    const adj = computeAdjacency([A, B, C, D]);
    expect(adj.get("A")).toEqual(new Set(["B"]));
    expect(adj.get("B")).toEqual(new Set(["A", "C"]));
    expect(adj.get("C")).toEqual(new Set(["B", "D"]));
    expect(adj.get("D")).toEqual(new Set(["C"]));
  });

  it("returns empty sets for disjoint polygons", () => {
    const A = square("A", 0, 0);
    const B = square("B", 10, 10);
    const adj = computeAdjacency([A, B]);
    expect(adj.get("A")).toEqual(new Set());
    expect(adj.get("B")).toEqual(new Set());
  });
});
```

**Step 2: Run, watch fail.** Module not found.

**Step 3: Implement.**

```ts
import * as turf from "@turf/turf";
import type { StrippedFeature } from "@/lib/cliopatria";

export function computeAdjacency(
  features: StrippedFeature[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const f of features) {
    adj.set(f.properties.Name, new Set());
  }
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const a = features[i]!;
      const b = features[j]!;
      // booleanIntersects covers both shared-edge and shared-vertex
      // adjacency. For map coloring we want shared-edge only; but
      // shared-vertex adjacency is rare in real-world data and the
      // belt-and-suspenders catch is acceptable for a coloring heuristic.
      if (turf.booleanIntersects(a as any, b as any)) {
        adj.get(a.properties.Name)!.add(b.properties.Name);
        adj.get(b.properties.Name)!.add(a.properties.Name);
      }
    }
  }
  return adj;
}
```

**Step 4: Run, watch pass.**

**Step 5: Commit.**

```
git add lib/map-colors.ts tests/unit/map-colors.test.ts
git commit -m "feat(map-colors): polygon adjacency via turf intersection"
```

---

## Task 3: Greedy graph coloring TDD

**Files:**
- Modify: `tests/unit/map-colors.test.ts`
- Modify: `lib/map-colors.ts`

**Step 1: Failing test.**

```ts
describe("colorGraph", () => {
  it("assigns no two adjacent nodes the same color", () => {
    const adj = new Map([
      ["A", new Set(["B"])],
      ["B", new Set(["A", "C"])],
      ["C", new Set(["B", "D"])],
      ["D", new Set(["C"])],
    ]);
    const colors = colorGraph(adj);
    expect(colors.get("A")).not.toBe(colors.get("B"));
    expect(colors.get("B")).not.toBe(colors.get("C"));
    expect(colors.get("C")).not.toBe(colors.get("D"));
  });

  it("uses palette colors only", () => {
    /* assert every assigned color is in PALETTE */
  });

  it("can color a complete graph K4 with at least 4 colors available", () => {
    /* K4 needs 4 colors */
  });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.**

```ts
const PALETTE = [
  "#e63946", "#f4a261", "#e9c46a", "#2a9d8f",
  "#264653", "#8338ec", "#06d6a0", "#118ab2",
  "#ef476f", "#ffd166", "#073b4c", "#7209b7",
];

export function colorGraph(
  adj: Map<string, Set<string>>,
): Map<string, string> {
  const colors = new Map<string, string>();
  // Sort nodes by degree descending — DSatur heuristic, more useful
  // for dense graphs but harmless for sparse ones too.
  const order = Array.from(adj.keys()).sort(
    (a, b) => adj.get(b)!.size - adj.get(a)!.size,
  );
  for (const name of order) {
    const used = new Set<string>();
    for (const neighbor of adj.get(name)!) {
      const c = colors.get(neighbor);
      if (c) used.add(c);
    }
    const pick = PALETTE.find((c) => !used.has(c)) ?? PALETTE[0]!;
    colors.set(name, pick);
  }
  return colors;
}
```

**Step 4: Run, watch pass.**

**Step 5: Commit.**

```
git add lib/map-colors.ts tests/unit/map-colors.test.ts
git commit -m "feat(map-colors): greedy graph coloring with 12-color palette"
```

---

## Task 4: `MemberOf` color families TDD

**Files:**
- Modify: `tests/unit/map-colors.test.ts`
- Modify: `lib/map-colors.ts`

**Step 1: Failing test.**

```ts
describe("assignColors with MemberOf families", () => {
  it("members of the same parent share a hue family", () => {
    /*
      Three features all MemberOf "Holy Roman Empire", non-adjacent
      to each other. Expect their assigned colors to be variants
      from the same family (we'll define families as palette index
      groupings — e.g. each base color has 3 lightness variants).
    */
  });

  it("falls back to base palette when no MemberOf is set", () => {
    /* features without MemberOf get base palette colors */
  });
});
```

The architecture is precise about the *what* (color families) but not the *how*. Pick: each palette base color has 3 lightness variants (e.g. light / base / dark), giving 36 total colors. Members of the same parent get variants of one base; non-members rotate through bases.

**Step 2: Run, watch fail.**

**Step 3: Implement `assignColors` orchestrating adjacency + family-aware coloring.**

```ts
export function assignColors(
  features: StrippedFeature[],
): StrippedFeature[] {
  const adj = computeAdjacency(features);
  const baseColors = colorGraph(adj);
  // Family pass: gather features grouped by MemberOf, then within
  // each family pick a single base color and assign lightness variants.
  // (Implementation details — palette of variants, family registry —
  // grow alongside this task as tests demand.)
  return features.map((f) => ({
    ...f,
    properties: {
      ...f.properties,
      color: deriveFamilyAwareColor(f, baseColors),
    },
  }));
}
```

Flesh out `deriveFamilyAwareColor` to satisfy the failing tests. Each test failure tells you what `assignColors` is missing; implement to the test, not to imagined future requirements.

**Step 4: Run, watch pass.**

**Step 5: Commit.**

```
git add lib/map-colors.ts tests/unit/map-colors.test.ts
git commit -m "feat(map-colors): assignColors with MemberOf-based color families"
```

---

## Task 5: Smoke test on filtered Cliopatria

Real-data sanity check — load Cliopatria, filter at a known year (e.g. 1815), assign colors, verify every feature has a `color` property and no two adjacent features share one.

**Step 1: Add test (skipped if dataset absent).**

```ts
const realDatasetPresent = existsSync("public/data/cliopatria.geojson");
const describeWithReal = realDatasetPresent ? describe : describe.skip;

describeWithReal("assignColors on real Cliopatria filtered to 1815", () => {
  it("produces no adjacent same-color pairs", async () => {
    const fc = await loadCliopatria();
    const filtered = filterByYear(fc.features, 1815);
    const stripped = stripYearData(filtered);
    const colored = assignColors(stripped);
    /* iterate adjacency, assert no neighbor pair shares a color */
  });
});
```

**Step 2: Run, fix any palette-exhausted edge cases (the fallback `PALETTE[0]` is a real risk on dense graphs — log a warning if it fires, increase palette if needed).**

**Step 3: Commit.**

```
git add tests/unit/map-colors.test.ts
git commit -m "test(map-colors): real-cliopatria smoke test for adjacency-correct coloring"
```

---

## Verification before merge

- All unit tests green (`npm test -- --selectProjects unit`).
- Typecheck + lint clean.
- Build clean.
- The smoke test on real Cliopatria passes locally.

## Merge

```
git checkout main
git merge --no-ff phase/8-color-assignment -m "merge: phase 8 — graph-coloring with memberof families"
git push origin main
```
