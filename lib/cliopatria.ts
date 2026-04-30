import { readFile } from "node:fs/promises";
import type { Geometry } from "geojson";

export interface CliopatriaFeature {
  type: "Feature";
  geometry: Geometry;
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

const DEFAULT_PATH = "public/data/cliopatria-0.0.1/cliopatria.geojson";

let cache: CliopatriaFeatureCollection | null = null;
let cachedPath: string | null = null;

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

export function filterByYear(
  features: CliopatriaFeature[],
  year: number,
): CliopatriaFeature[] {
  return features.filter(
    (f) => f.properties.FromYear <= year && year <= f.properties.ToYear,
  );
}

export interface StrippedFeature {
  type: "Feature";
  geometry: Geometry;
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

// Test-only helper. Resets the module-level cache so each test starts
// from a clean state.
export function _resetCliopatriaCache(): void {
  cache = null;
  cachedPath = null;
}
