import {
  loadCliopatria,
  filterByYear,
  stripYearData,
} from "@/lib/cliopatria";
import { assignColors } from "@/lib/map-colors";
import { DEMO_YEARS, DEFAULT_DEMO_YEAR, findDemoYear } from "@/lib/demo-years";
import type { MapFeatureCollection } from "./play/types";
import { MapPanel } from "./play/MapPanel";
import { YearPicker, type YearPickerOption } from "./YearPicker";

const PICKER_OPTIONS: YearPickerOption[] = DEMO_YEARS.map((d) => ({
  value: d.value,
  label: d.label,
}));

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const { year: yearParam } = await searchParams;
  const selected = findDemoYear(yearParam) ?? DEFAULT_DEMO_YEAR;

  const dataset = await loadCliopatria();
  const filtered = filterByYear(dataset.features, selected.year);
  const stripped = stripYearData(filtered);
  const colored = assignColors(stripped);

  const geojson: MapFeatureCollection = {
    type: "FeatureCollection",
    features: colored,
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
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
      <MapPanel geojson={geojson} />
    </div>
  );
}
