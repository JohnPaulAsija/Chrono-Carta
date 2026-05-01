# Phase 8 — Color Assignment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. TDD discipline per superpowers:test-driven-development for each task below.

**Goal:** `lib/map-colors.ts` exporting `assignColors(features)` so map creation can annotate every feature with a stable, distinct, family-aware color before storing the map.

**Architecture:** Per architecture §Color Assignment. Three responsibilities:

1. Compute polygon adjacency from geometries (which polygons share a border).
2. Generate a per-map palette of N maximally-distinct base hues sized to the actual feature count — no fixed 12-color list to exhaust. Inspired by upstream Cliopatria's use of [`distinctipy`](https://github.com/alan-turing-institute/distinctipy) ([convert_data.py:26-32](public/data/cliopatria-0.0.1/notebooks/convert_data.py)), reimplemented in TypeScript via farthest-point sampling in HSL space with a fixed seed for deterministic tests.
3. Run a greedy graph-coloring pass with **family preference** (option 4 from design discussion): each `MemberOf` group gets one base hue and K lightness variants (K = group size); the greedy pass prefers variants of a node's family base but falls back to other-family colors when the family pool is locally exhausted. Family is a soft signal that degrades gracefully under graph density rather than competing with adjacency for palette slots.

Result: every feature gets a `color` property that the client renders directly with no further computation.

**Tech Stack:** `@turf/turf` for polygon adjacency (specifically `booleanIntersects`). Pure TypeScript distinct-color generator and greedy graph coloring. Unit-tested with hand-built fixtures.

**Design decision — option 4 (family-as-preference).** Earlier-considered alternatives (strict family / strict adjacency / two-tier rendering) all required either a hard family-vs-adjacency tradeoff or scope expansion into the renderer. Option 4 keeps the entire problem inside `lib/map-colors.ts`, sidesteps fixed-palette exhaustion by generating the palette to fit, and lets dense regions soften the family signal rather than break the adjacency rule.

**Palette exhaustion is observable.** When a node is forced to a color used by a neighbor (no non-conflicting choice in the entire generated palette), `assignColors` calls `console.warn` with the feature name and adjacency count. The smoke test asserts the warning count is reasonable on real Cliopatria data.

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

## Task 3: Distinct-color generator TDD

**Goal:** `generateDistinctColors(n, seed?)` produces N hex colors maximally separated in HSL space, deterministic for a given seed. This replaces the fixed 12-color `PALETTE` from the original sketch — the per-map palette is sized to the feature count, so there's nothing to exhaust at the base-hue level.

**Files:**
- Modify: `tests/unit/map-colors.test.ts`
- Modify: `lib/map-colors.ts`

**Step 1: Failing tests.**

```ts
import { generateDistinctColors, hexToHsl } from "@/lib/map-colors";

describe("generateDistinctColors", () => {
  it("returns n hex colors", () => {
    const colors = generateDistinctColors(8);
    expect(colors).toHaveLength(8);
    for (const c of colors) {
      expect(c).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("returns no duplicates", () => {
    const colors = generateDistinctColors(24);
    expect(new Set(colors).size).toBe(24);
  });

  it("is deterministic for a given seed", () => {
    expect(generateDistinctColors(12, 42)).toEqual(generateDistinctColors(12, 42));
  });

  it("spaces hues so the minimum pairwise hue gap stays above a threshold for small n", () => {
    // For n ≤ 24, every pair should be at least 360/n * 0.5 degrees apart in hue.
    const n = 12;
    const colors = generateDistinctColors(n);
    const hues = colors.map((c) => hexToHsl(c).h);
    const minGap = Math.min(
      ...hues.flatMap((h1, i) =>
        hues.slice(i + 1).map((h2) => {
          const d = Math.abs(h1 - h2) % 360;
          return Math.min(d, 360 - d);
        }),
      ),
    );
    expect(minGap).toBeGreaterThan((360 / n) * 0.5);
  });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.**

Approach: golden-angle hue sweep (137.508° increments) gives an even hue distribution for any N without lookup tables. Saturation and lightness modulate gently with index so neighbors in the sequence don't all look identical at the same luminance — keeps the output legible against a light map background.

```ts
const GOLDEN_ANGLE = 137.508;

export function generateDistinctColors(n: number, seed = 0): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const h = (seed * 13 + i * GOLDEN_ANGLE) % 360;
    // Keep saturation high enough to read as colored, lightness mid-range.
    const s = 60 + ((i * 7) % 25); // 60-85
    const l = 45 + ((i * 11) % 20); // 45-65
    out.push(hslToHex({ h, s, l }));
  }
  return out;
}

export function hexToHsl(hex: string): { h: number; s: number; l: number } { /* ... */ }
export function hslToHex(hsl: { h: number; s: number; l: number }): string { /* ... */ }
```

`hexToHsl` / `hslToHex` are exported because Task 4 needs them for variant generation. Standard conversion — no library needed.

**Step 4: Run, watch pass.**

**Step 5: Commit.**

```
git add lib/map-colors.ts tests/unit/map-colors.test.ts
git commit -m "feat(map-colors): distinct-color generator via golden-angle HSL sweep"
```

---

## Task 4: Family-aware `assignColors` TDD (option 4)

**Goal:** Orchestrate adjacency + per-family base hue + per-family lightness variants + greedy graph coloring with family preference. This is the public API the rest of the app calls.

**Algorithm:**

1. Compute adjacency (Task 2).
2. Group features by `MemberOf`. Empty/null `MemberOf` → each such feature is its own singleton group keyed by feature `Name`. Sort group keys deterministically (alphabetical) so palette assignment is stable across runs.
3. Generate one base hue per group via `generateDistinctColors(numGroups)`. Group key → base hue.
4. For each group, generate K lightness variants of its base hue where K = group size. Variant generation: convert base to HSL, hold H constant, spread L evenly across the legible range (35–70). K=1 → just the base. K=N → N evenly-spaced lightness levels.
5. Greedy graph coloring, nodes ordered by degree desc:
   - Build the **preferred candidate list** = the node's family variants (its group's K-color pool), in order.
   - Build the **fallback candidate list** = all other colors (other families' bases and variants), in order of base-hue distance from the node's family base (so a forced fallback picks something visually close rather than jarring).
   - Pick the first candidate not used by any neighbor. Try preferred first, then fallback.
   - If both lists are exhausted, pick the color used by the fewest neighbors and `console.warn({ name, neighbors: adj.get(name)!.size, fellBackTo: pick })`. The function must not throw — every feature gets a color.

**Files:**
- Modify: `tests/unit/map-colors.test.ts`
- Modify: `lib/map-colors.ts`

**Step 1: Failing tests.**

```ts
describe("assignColors", () => {
  it("annotates every feature with a color property", () => {
    const features = [square("A", 0, 0), square("B", 5, 5)];
    const colored = assignColors(features);
    for (const f of colored) {
      expect(f.properties.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("assigns no adjacent pair the same color when palette has capacity", () => {
    // Chain A-B-C-D, all singletons. Palette has plenty of slots.
    const colored = assignColors([
      square("A", 0, 0), square("B", 1, 0),
      square("C", 2, 0), square("D", 3, 0),
    ]);
    const byName = new Map(colored.map((f) => [f.properties.Name, f.properties.color]));
    expect(byName.get("A")).not.toBe(byName.get("B"));
    expect(byName.get("B")).not.toBe(byName.get("C"));
    expect(byName.get("C")).not.toBe(byName.get("D"));
  });

  it("places same-family non-adjacent members in the same hue family", () => {
    // Three HRE members, none adjacent to each other.
    const features = [
      { ...square("Bavaria", 0, 0), properties: { Name: "Bavaria", MemberOf: "HRE" } },
      { ...square("Saxony", 5, 5), properties: { Name: "Saxony", MemberOf: "HRE" } },
      { ...square("Prussia", 10, 10), properties: { Name: "Prussia", MemberOf: "HRE" } },
    ];
    const colored = assignColors(features);
    const hues = colored.map((f) => hexToHsl(f.properties.color!).h);
    // All three within 15° of each other on the hue wheel.
    const maxGap = Math.max(...hues.flatMap((h1) => hues.map((h2) => {
      const d = Math.abs(h1 - h2) % 360;
      return Math.min(d, 360 - d);
    })));
    expect(maxGap).toBeLessThan(15);
  });

  it("differentiates same-family adjacent members via lightness", () => {
    // Two HRE members sharing a border. Same hue family, different lightness.
    const features = [
      { ...square("Bavaria", 0, 0), properties: { Name: "Bavaria", MemberOf: "HRE" } },
      { ...square("Saxony", 1, 0), properties: { Name: "Saxony", MemberOf: "HRE" } },
    ];
    const colored = assignColors(features);
    const [a, b] = colored.map((f) => hexToHsl(f.properties.color!));
    expect(a.h).toBeCloseTo(b.h, 0);          // same hue
    expect(Math.abs(a.l - b.l)).toBeGreaterThan(8); // distinct lightness
    expect(a).not.toEqual(b);
  });

  it("warns and falls through (without throwing) when palette is locally exhausted", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    // Construct a high-degree configuration: a central polygon surrounded by N
    // family-mates plus N other-family neighbors in a clique-like layout.
    // (Test fixture details: pick N large enough that family variants and
    // non-conflicting fallbacks both run out for the central node.)
    const colored = assignColors(buildHighDegreeFixture());
    expect(colored.every((f) => f.properties.color)).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("treats features without MemberOf as singleton groups", () => {
    // Two non-adjacent features, no MemberOf — they get distinct base hues, not variants of one.
    const features = [
      { ...square("X", 0, 0), properties: { Name: "X" } },
      { ...square("Y", 10, 10), properties: { Name: "Y" } },
    ];
    const [x, y] = assignColors(features);
    const hx = hexToHsl(x!.properties.color!).h;
    const hy = hexToHsl(y!.properties.color!).h;
    const hueGap = Math.min(Math.abs(hx - hy), 360 - Math.abs(hx - hy));
    expect(hueGap).toBeGreaterThan(20);
  });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement.**

```ts
export function assignColors(features: StrippedFeature[]): StrippedFeature[] {
  const adj = computeAdjacency(features);

  // 1. Group by MemberOf. Empty/null → singleton keyed by Name.
  const groupKey = (f: StrippedFeature): string =>
    f.properties.MemberOf?.trim() ? f.properties.MemberOf : `__singleton__${f.properties.Name}`;
  const groups = new Map<string, StrippedFeature[]>();
  for (const f of features) {
    const k = groupKey(f);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(f);
  }

  // 2. Deterministic group ordering.
  const groupKeys = Array.from(groups.keys()).sort();
  const baseHues = generateDistinctColors(groupKeys.length);

  // 3. Per-group variant pool.
  const groupPool = new Map<string, string[]>();
  for (let i = 0; i < groupKeys.length; i++) {
    const k = groupKeys[i]!;
    const base = baseHues[i]!;
    const k_size = groups.get(k)!.length;
    groupPool.set(k, generateLightnessVariants(base, k_size));
  }

  // 4. Greedy with preference.
  const assigned = new Map<string, string>();
  const order = features
    .slice()
    .sort((a, b) => (adj.get(b.properties.Name)!.size - adj.get(a.properties.Name)!.size));

  for (const f of order) {
    const name = f.properties.Name;
    const k = groupKey(f);
    const usedByNeighbors = new Set<string>();
    for (const n of adj.get(name)!) {
      const c = assigned.get(n);
      if (c) usedByNeighbors.add(c);
    }

    // Preferred = own family variants.
    const preferred = groupPool.get(k)!;
    let pick = preferred.find((c) => !usedByNeighbors.has(c));

    // Fallback = other groups' colors, sorted by hue distance from family base.
    if (!pick) {
      const familyBase = preferred[0]!;
      const fallback = groupKeys
        .filter((gk) => gk !== k)
        .flatMap((gk) => groupPool.get(gk)!)
        .sort((a, b) => hueDistance(familyBase, a) - hueDistance(familyBase, b));
      pick = fallback.find((c) => !usedByNeighbors.has(c));
    }

    // Forced collision — warn but always assign.
    if (!pick) {
      const all = groupKeys.flatMap((gk) => groupPool.get(gk)!);
      const usageCount = new Map<string, number>();
      for (const c of all) usageCount.set(c, 0);
      for (const c of usedByNeighbors) usageCount.set(c, (usageCount.get(c) ?? 0) + 1);
      pick = [...all].sort((a, b) => usageCount.get(a)! - usageCount.get(b)!)[0]!;
      console.warn(
        `[map-colors] palette exhausted for "${name}" (neighbors=${adj.get(name)!.size}); fell back to ${pick}`,
      );
    }

    assigned.set(name, pick);
  }

  return features.map((f) => ({
    ...f,
    properties: { ...f.properties, color: assigned.get(f.properties.Name)! },
  }));
}

function generateLightnessVariants(baseHex: string, k: number): string[] {
  const { h, s } = hexToHsl(baseHex);
  if (k === 1) return [baseHex];
  const out: string[] = [];
  // Spread lightness evenly across legible range [35, 70].
  for (let i = 0; i < k; i++) {
    const l = 35 + (i * 35) / (k - 1);
    out.push(hslToHex({ h, s, l }));
  }
  return out;
}

function hueDistance(a: string, b: string): number {
  const ha = hexToHsl(a).h;
  const hb = hexToHsl(b).h;
  const d = Math.abs(ha - hb) % 360;
  return Math.min(d, 360 - d);
}
```

**Step 4: Run, watch pass.**

**Step 5: Commit.**

```
git add lib/map-colors.ts tests/unit/map-colors.test.ts
git commit -m "feat(map-colors): assignColors with family-as-preference graph coloring"
```

---

## Task 5: Smoke test on filtered Cliopatria

Real-data sanity check — load Cliopatria, filter at a known year (e.g. 1815), assign colors, verify every feature has a `color` property, observe that the warning rate is reasonable, and check that the vast majority of adjacent pairs have distinct colors.

**Step 1: Add test (skipped if dataset absent).**

```ts
import { existsSync } from "node:fs";
import { loadCliopatria, filterByYear, stripYearData } from "@/lib/cliopatria";
import { assignColors, computeAdjacency } from "@/lib/map-colors";

const datasetPath = "public/data/cliopatria-0.0.1/cliopatria.geojson";
const realDatasetPresent = existsSync(datasetPath);
const describeWithReal = realDatasetPresent ? describe : describe.skip;

describeWithReal("assignColors on real Cliopatria filtered to 1815", () => {
  it("annotates every feature and keeps palette-exhaustion warnings rare", async () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const fc = await loadCliopatria();
    const filtered = filterByYear(fc.features, 1815);
    const stripped = stripYearData(filtered);
    const colored = assignColors(stripped);

    // Every feature has a color.
    for (const f of colored) {
      expect(f.properties.color).toMatch(/^#[0-9a-f]{6}$/);
    }

    // Adjacency check: count how many adjacent pairs share a color.
    const adj = computeAdjacency(colored);
    const colorByName = new Map(colored.map((f) => [f.properties.Name, f.properties.color]));
    let conflicts = 0;
    let pairs = 0;
    for (const [name, neighbors] of adj) {
      for (const n of neighbors) {
        if (name < n) {
          pairs++;
          if (colorByName.get(name) === colorByName.get(n)) conflicts++;
        }
      }
    }
    // Conflicts should be rare — these are the cases where the palette was
    // locally exhausted for a high-degree node. Threshold is intentionally
    // loose; tighten if it turns out to be very low in practice.
    expect(conflicts / Math.max(pairs, 1)).toBeLessThan(0.05);

    // Warnings should fire only in the cases where conflicts occurred.
    // (One warn per forced collision.)
    expect(warnSpy.mock.calls.length).toBe(conflicts);
    warnSpy.mockRestore();
  });
});
```

**Step 2: Run.** If the conflict rate is above 5%, the assertion fails and tells us the palette / variant count needs tuning. Per the design discussion, our first lever is to widen the lightness range or add saturation variants to `generateLightnessVariants`; the second lever is to bias the family preference more aggressively toward the lightest/darkest available variant before falling through. Do not silently raise the threshold without first understanding why the rate is high — a high conflict rate on real data is the signal that the algorithm needs adjusting, not the test.

**Step 3: Commit.**

```
git add tests/unit/map-colors.test.ts
git commit -m "test(map-colors): real-cliopatria smoke test for assignColors"
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
