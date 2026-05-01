import { computeAdjacency } from "@/lib/map-colors";
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
