import {
  computeAdjacency,
  generateDistinctColors,
  hexToHsl,
} from "@/lib/map-colors";
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
