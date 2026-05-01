import { rewind } from "@turf/turf";
import {
  loadCliopatria,
  filterByYear,
  stripYearData,
  type CliopatriaFeature,
} from "@/lib/cliopatria";
import { assignColors } from "@/lib/map-colors";
import type { MapFeatureCollection } from "@/app/(game)/play/types";

const cache = new Map<number, MapFeatureCollection>();

export async function getColoredMapForYear(
  year: number,
): Promise<MapFeatureCollection> {
  const cached = cache.get(year);
  if (cached) return cached;

  const dataset = await loadCliopatria();
  const filtered = filterByYear(dataset.features, year)
    .filter((f) => !f.properties.Name.startsWith("("))
    .map((f) => rewind(f, { reverse: true }) as CliopatriaFeature);
  const stripped = stripYearData(filtered);
  const colored = assignColors(stripped);

  const result: MapFeatureCollection = {
    type: "FeatureCollection",
    features: colored,
  };

  cache.set(year, result);
  return result;
}
