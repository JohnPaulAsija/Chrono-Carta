import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { StrippedFeature } from "@/lib/cliopatria";

type PolygonalFeature = Feature<Polygon | MultiPolygon>;

function isPolygonal(f: StrippedFeature): f is StrippedFeature & PolygonalFeature {
  return f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon";
}

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
      if (!isPolygonal(a) || !isPolygonal(b)) continue;
      // booleanIntersects covers shared-edge and shared-vertex adjacency.
      // Shared-vertex over-counts slightly but the false positives are
      // rare in real data and acceptable for a coloring heuristic.
      if (turf.booleanIntersects(a, b)) {
        adj.get(a.properties.Name)!.add(b.properties.Name);
        adj.get(b.properties.Name)!.add(a.properties.Name);
      }
    }
  }
  return adj;
}
