import { bbox } from "@turf/bbox";
import { DEMO_YEARS, DEFAULT_DEMO_YEAR, findDemoYear } from "@/lib/demo-years";
import { getColoredMapForYear } from "@/lib/demo-map-cache";
import { MapPanel } from "./play/MapPanel";
import { YearPicker, type YearPickerOption } from "./YearPicker";
import type { MapFeatureCollection } from "./play/types";

const PICKER_OPTIONS: YearPickerOption[] = DEMO_YEARS.map((d) => ({
  value: d.value,
  label: d.label,
}));

function computeInitialView(
  geojson: MapFeatureCollection,
  focusEntity: string,
): { center: [number, number]; zoom: number } {
  const feature = geojson.features.find(
    (f) => f.properties.Name === focusEntity,
  );
  if (!feature) return { center: [0, 0], zoom: 1 };

  const [minLng, minLat, maxLng, maxLat] = bbox(feature);
  const center: [number, number] = [
    (minLng + maxLng) / 2,
    (minLat + maxLat) / 2,
  ];
  const span = Math.max(maxLng - minLng, maxLat - minLat, 1);
  const zoom = Math.min(Math.max(Math.round(180 / span), 1), 32);
  return { center, zoom };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const selected = findDemoYear(yearParam) ?? DEFAULT_DEMO_YEAR;

  const geojson = await getColoredMapForYear(selected.year);
  const { center, zoom } = computeInitialView(geojson, selected.focusEntity);

  return (
    <div className="flex h-screen flex-col gap-4 overflow-hidden p-6">
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
      <MapPanel
        geojson={geojson}
        initialCenter={center}
        initialZoom={zoom}
      />
      <footer className="shrink-0 text-xs text-zinc-400 dark:text-zinc-500">
        <p>
          Proof of concept — active development, not a finished product.
          Map data from{" "}
          <a
            href="https://github.com/aourednik/historical-basemaps"
            className="underline hover:text-zinc-600 dark:hover:text-zinc-300"
            target="_blank"
            rel="noopener noreferrer"
          >
            Cliopatria
          </a>{" "}
          (Seshat / Ourednik, v0.0.1, CC BY-SA 4.0).
        </p>
      </footer>
    </div>
  );
}
