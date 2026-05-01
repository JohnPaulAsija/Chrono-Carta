import { existsSync } from "node:fs";

import {
  assignColors,
  computeAdjacency,
  generateDistinctColors,
  hexToHsl,
} from "@/lib/map-colors";
import {
  _resetCliopatriaCache,
  filterByYear,
  loadCliopatria,
  stripYearData,
} from "@/lib/cliopatria";
import type { StrippedFeature } from "@/lib/cliopatria";

function square(name: string, originX: number, originY: number): StrippedFeature {
  return {
    type: "Feature",
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [originX, originY],
          [originX + 1, originY],
          [originX + 1, originY + 1],
          [originX, originY + 1],
          [originX, originY],
        ],
      ],
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
    expect(generateDistinctColors(12, 42)).toEqual(
      generateDistinctColors(12, 42),
    );
  });

  it("spaces hues so the minimum pairwise hue gap stays above a threshold for small n", () => {
    const n = 12;
    const colors = generateDistinctColors(n);
    const hues = colors.map((c) => hexToHsl(c).h);
    let minGap = 360;
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const d = Math.abs(hues[i]! - hues[j]!) % 360;
        const gap = Math.min(d, 360 - d);
        if (gap < minGap) minGap = gap;
      }
    }
    expect(minGap).toBeGreaterThan((360 / n) * 0.5);
  });

  it("returns an empty array for n=0", () => {
    expect(generateDistinctColors(0)).toEqual([]);
  });
});

function familySquare(
  name: string,
  originX: number,
  originY: number,
  memberOf?: string,
): StrippedFeature {
  const base = square(name, originX, originY);
  if (memberOf !== undefined) {
    base.properties = { ...base.properties, MemberOf: memberOf };
  }
  return base;
}

function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
}

describe("assignColors", () => {
  it("annotates every feature with a hex color property", () => {
    const colored = assignColors([square("A", 0, 0), square("B", 5, 5)]);
    for (const f of colored) {
      expect((f.properties as { color?: string }).color).toMatch(
        /^#[0-9a-f]{6}$/,
      );
    }
  });

  it("assigns no adjacent pair the same color when palette has capacity", () => {
    const colored = assignColors([
      square("A", 0, 0),
      square("B", 1, 0),
      square("C", 2, 0),
      square("D", 3, 0),
    ]);
    const byName = new Map(
      colored.map((f) => [
        f.properties.Name,
        (f.properties as { color: string }).color,
      ]),
    );
    expect(byName.get("A")).not.toBe(byName.get("B"));
    expect(byName.get("B")).not.toBe(byName.get("C"));
    expect(byName.get("C")).not.toBe(byName.get("D"));
  });

  it("places same-family non-adjacent members in the same hue family", () => {
    const colored = assignColors([
      familySquare("Bavaria", 0, 0, "HRE"),
      familySquare("Saxony", 5, 5, "HRE"),
      familySquare("Prussia", 10, 10, "HRE"),
    ]);
    const hues = colored.map(
      (f) => hexToHsl((f.properties as { color: string }).color).h,
    );
    let maxGap = 0;
    for (let i = 0; i < hues.length; i++) {
      for (let j = i + 1; j < hues.length; j++) {
        const g = hueGap(hues[i]!, hues[j]!);
        if (g > maxGap) maxGap = g;
      }
    }
    expect(maxGap).toBeLessThan(2);
  });

  it("differentiates same-family adjacent members via lightness", () => {
    const colored = assignColors([
      familySquare("Bavaria", 0, 0, "HRE"),
      familySquare("Saxony", 1, 0, "HRE"),
    ]);
    const hsls = colored.map((f) =>
      hexToHsl((f.properties as { color: string }).color),
    );
    expect(hueGap(hsls[0]!.h, hsls[1]!.h)).toBeLessThan(2);
    expect(Math.abs(hsls[0]!.l - hsls[1]!.l)).toBeGreaterThan(8);
    expect(hsls[0]).not.toEqual(hsls[1]);
  });

  it("treats features without MemberOf as singleton groups", () => {
    const colored = assignColors([
      square("X", 0, 0),
      square("Y", 10, 10),
    ]);
    const hx = hexToHsl((colored[0]!.properties as { color: string }).color).h;
    const hy = hexToHsl((colored[1]!.properties as { color: string }).color).h;
    expect(hueGap(hx, hy)).toBeGreaterThan(20);
  });

  it("treats empty-string MemberOf as a singleton, not a shared family", () => {
    const colored = assignColors([
      familySquare("X", 0, 0, ""),
      familySquare("Y", 10, 10, ""),
    ]);
    const hx = hexToHsl((colored[0]!.properties as { color: string }).color).h;
    const hy = hexToHsl((colored[1]!.properties as { color: string }).color).h;
    expect(hueGap(hx, hy)).toBeGreaterThan(20);
  });
});

const REAL_DATASET = "public/data/cliopatria-0.0.1/cliopatria.geojson";
const describeWithReal = existsSync(REAL_DATASET) ? describe : describe.skip;

describeWithReal("assignColors on real Cliopatria filtered to 1815", () => {
  beforeAll(() => _resetCliopatriaCache());

  it("annotates every feature with a unique-from-neighbors color", async () => {
    const fc = await loadCliopatria();
    const filtered = filterByYear(fc.features, 1815);
    const stripped = stripYearData(filtered);
    const colored = assignColors(stripped);

    for (const f of colored) {
      expect((f.properties as { color: string }).color).toMatch(
        /^#[0-9a-f]{6}$/,
      );
    }

    const adj = computeAdjacency(colored);
    const colorByName = new Map(
      colored.map((f) => [
        f.properties.Name,
        (f.properties as { color: string }).color,
      ]),
    );
    for (const [name, neighbors] of adj) {
      for (const n of neighbors) {
        if (name < n) {
          expect(colorByName.get(name)).not.toBe(colorByName.get(n));
        }
      }
    }
  }, 30000);
});
