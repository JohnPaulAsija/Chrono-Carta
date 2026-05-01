# Demo Map Fixes Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix four visual/performance issues in the landing-page demo: add ocean background, fix label positioning, cache color assignments, and add legend click-to-zoom.

**Architecture:** All fixes modify existing Phase 7/8 components on the `feat/landing-demo-map` branch. Issues 1-3 touch `app/(game)/play/` components and the test mock; Issue 4 touches the demo page's server-side pipeline. Changes are additive — no existing behavior is removed.

**Tech Stack:** `@vnedyalk0v/react19-simple-maps` (`Sphere`, `Marker` components), `@turf/bbox` for bounding-box computation, Jest + RTL for tests.

**Design doc:** `docs/plans/2026-05-01-demo-map-fixes-design.md`

**Branch:** `feat/landing-demo-map` (already exists, demo wiring already committed)

---

## Task 1: Add ocean background with `<Sphere>`

**Why first:** Smallest change, biggest visual improvement. Turns the magenta void into a blue ocean.

**Files:**
- Modify: `app/(game)/play/MapViewer.tsx` (add `Sphere` import and element)
- Modify: `tests/__mocks__/react19-simple-maps.tsx` (add `Sphere` mock)
- Modify: `tests/unit/MapViewer.test.tsx` (add ocean-background test)

**Step 1: Write the failing test**

Add to the `MapViewer` describe block in `tests/unit/MapViewer.test.tsx`:

```tsx
it("renders an ocean background", () => {
  const { container } = render(<MapViewer geojson={fixture} />);
  const sphere = container.querySelector("[data-testid='sphere']");
  expect(sphere).not.toBeNull();
  expect(sphere?.getAttribute("fill")).toBe("#a8d5e2");
});
```

**Step 2: Run test — expect failure**

Run: `npx jest --selectProjects unit tests/unit/MapViewer.test.tsx -t "renders an ocean background"`
Expected: FAIL — no element with `data-testid='sphere'`.

**Step 3: Add `Sphere` mock to `tests/__mocks__/react19-simple-maps.tsx`**

Add after the existing `ZoomableGroup` export:

```tsx
export function Sphere(props: { [key: string]: unknown }) {
  return <circle data-testid="sphere" r="100" {...props} />;
}
```

**Step 4: Add `Sphere` to `MapViewer.tsx`**

Add `Sphere` to the import from `@vnedyalk0v/react19-simple-maps`:

```tsx
import {
  ComposableMap,
  createCoordinates,
  Geographies,
  Geography,
  Sphere,
  ZoomableGroup,
} from "@vnedyalk0v/react19-simple-maps";
```

Add `<Sphere>` inside `<ComposableMap>`, before `<ZoomableGroup>`:

```tsx
<ComposableMap projection="geoEqualEarth">
  <Sphere fill="#a8d5e2" stroke="#ccc" />
  <ZoomableGroup
```

**Step 5: Run test — expect pass**

Run: `npx jest --selectProjects unit tests/unit/MapViewer.test.tsx`
Expected: all tests pass.

**Step 6: Commit**

```bash
git add app/(game)/play/MapViewer.tsx tests/__mocks__/react19-simple-maps.tsx tests/unit/MapViewer.test.tsx
git commit -m "fix(map): add ocean background with Sphere component"
```

---

## Task 2: Fix label positioning with `<Marker>`

**Why:** Labels currently render at raw geographic coordinates instead of projected SVG coordinates, causing them to cluster in the wrong position.

**Files:**
- Modify: `app/(game)/play/MapViewer.tsx` (replace `<text>` with `<Marker>`)
- Modify: `tests/__mocks__/react19-simple-maps.tsx` (add `Marker` mock)
- Test: `tests/unit/MapViewer.test.tsx` (existing label tests continue to pass)

**Step 1: Add `Marker` mock to `tests/__mocks__/react19-simple-maps.tsx`**

Add after the `Sphere` export:

```tsx
export function Marker({
  coordinates,
  children,
  ...rest
}: {
  coordinates: [number, number];
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return (
    <g data-testid="marker" data-coordinates={coordinates.join(",")} {...rest}>
      {children}
    </g>
  );
}
```

**Step 2: Update `MapViewer.tsx` — import `Marker`**

Add `Marker` to the import:

```tsx
import {
  ComposableMap,
  createCoordinates,
  Geographies,
  Geography,
  Marker,
  Sphere,
  ZoomableGroup,
} from "@vnedyalk0v/react19-simple-maps";
```

**Step 3: Replace the `<text>` label block with `<Marker>`**

Replace the `labeledEntities?.map(...)` block (lines 66-81 before Task 1 edits) with:

```tsx
{labeledEntities?.map((feature) => {
  const c = centroid(feature);
  const [lng, lat] = c.geometry.coordinates;
  return (
    <Marker
      key={`label-${feature.properties.Name}`}
      coordinates={createCoordinates(lng!, lat!)}
    >
      <text
        data-label={feature.properties.Name}
        textAnchor="middle"
        className="pointer-events-none fill-current text-xs font-medium"
      >
        {feature.properties.Name}
      </text>
    </Marker>
  );
})}
```

**Step 4: Run existing tests — expect pass**

Run: `npx jest --selectProjects unit tests/unit/MapViewer.test.tsx`
Expected: all tests pass. The existing label tests in "MapPanel — permanent labels" query for `text[data-label]` which is still rendered inside each `<Marker>`.

**Step 5: Commit**

```bash
git add app/(game)/play/MapViewer.tsx tests/__mocks__/react19-simple-maps.tsx
git commit -m "fix(map): position labels with Marker projection instead of raw coordinates"
```

---

## Task 3: Cache per-year color assignments

**Why:** `assignColors` runs O(n^2) Turf.js geometry intersections on every request. Caching the result per year makes only the first load slow; subsequent loads for the same year are instant.

**Files:**
- Create: `lib/demo-map-cache.ts`
- Modify: `app/(game)/page.tsx` (use cache helper instead of inline pipeline)

**No unit test.** The cache is a thin server-side memoization layer for the demo page. Its correctness is verified by the smoke test (same map data on reload, fast subsequent loads). Unit-testing it would require mocking `loadCliopatria` + filesystem — high cost, low signal for a temporary demo feature.

**Step 1: Create `lib/demo-map-cache.ts`**

```ts
import {
  loadCliopatria,
  filterByYear,
  stripYearData,
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
  const filtered = filterByYear(dataset.features, year);
  const stripped = stripYearData(filtered);
  const colored = assignColors(stripped);

  const result: MapFeatureCollection = {
    type: "FeatureCollection",
    features: colored,
  };

  cache.set(year, result);
  return result;
}
```

**Step 2: Update `app/(game)/page.tsx` to use the cache**

Replace the inline pipeline imports and logic. The full updated file:

```tsx
import { DEMO_YEARS, DEFAULT_DEMO_YEAR, findDemoYear } from "@/lib/demo-years";
import { getColoredMapForYear } from "@/lib/demo-map-cache";
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

  const geojson = await getColoredMapForYear(selected.year);

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
```

**Step 3: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

**Step 4: Run all unit tests**

Run: `npm run test:unit`
Expected: all pass (no test files reference the old imports directly).

**Step 5: Commit**

```bash
git add lib/demo-map-cache.ts app/(game)/page.tsx
git commit -m "perf(demo): cache per-year color assignments to eliminate redundant computation"
```

---

## Task 4: Add legend click-to-zoom

**Why:** Legend items have `cursor-pointer` CSS but no click behavior. Adding click-to-zoom lets users frame individual entities — the single most useful interactive feature for a demo.

**Files:**
- Modify: `app/(game)/play/Legend.tsx` (add `onClick` calling `onSelect`)
- Modify: `app/(game)/play/MapPanel.tsx` (add `handleSelect` that computes bbox and updates center/zoom)
- Test: `tests/unit/MapViewer.test.tsx` (add click-to-zoom test)

**Step 1: Write the failing test**

Add to the `MapPanel — legend` describe block in `tests/unit/MapViewer.test.tsx`:

```tsx
it("clicking a legend item zooms the map to that entity", async () => {
  const user = userEvent.setup();
  const { container } = render(<MapPanel geojson={fixture} />);
  const legend = screen.getByRole("complementary");
  const item = within(legend).getByText("Dalmatia");

  await user.click(item);

  const zoomGroup = container.querySelector("[data-testid='zoomable-group']")!;
  const zoom = Number(zoomGroup.getAttribute("data-zoom"));
  expect(zoom).toBeGreaterThan(1);
});
```

**Step 2: Run test — expect failure**

Run: `npx jest --selectProjects unit tests/unit/MapViewer.test.tsx -t "clicking a legend item zooms"`
Expected: FAIL — clicking doesn't change zoom.

**Step 3: Update `Legend.tsx` — add `onSelect` prop and `onClick`**

```tsx
"use client";

import type { MapFeature } from "./types";

export interface LegendProps {
  entities: MapFeature[];
  highlightedEntity: string | null;
  onHighlight: (name: string | null) => void;
  onSelect?: (feature: MapFeature) => void;
}

export function Legend({ entities, highlightedEntity, onHighlight, onSelect }: LegendProps) {
  return (
    <aside role="complementary" className="space-y-1 p-2">
      <h3 className="text-sm font-semibold">Entities</h3>
      <ul>
        {entities.map((feature) => {
          const { Name: name, color } = feature.properties;
          const isHighlighted = highlightedEntity === name;
          return (
            <li
              key={name}
              data-highlighted={isHighlighted ? "true" : undefined}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-gray-100"
              onMouseEnter={() => onHighlight(name)}
              onMouseLeave={() => onHighlight(null)}
              onClick={() => onSelect?.(feature)}
            >
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {name}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
```

**Step 4: Update `MapPanel.tsx` — add `handleSelect` with bbox computation**

Add `bbox` import at the top:

```tsx
import { bbox } from "@turf/bbox";
```

Add the handler inside `MapPanel`, after the existing `handleReset`:

```tsx
const handleSelect = useCallback((feature: MapFeature) => {
  const [minLng, minLat, maxLng, maxLat] = bbox(feature);
  const centerLng = (minLng + maxLng) / 2;
  const centerLat = (minLat + maxLat) / 2;
  setCenter([centerLng, centerLat]);

  const spanLng = maxLng - minLng;
  const spanLat = maxLat - minLat;
  const span = Math.max(spanLng, spanLat, 1);
  const fitZoom = Math.min(Math.max(Math.round(180 / span), MIN_ZOOM), MAX_ZOOM);
  setZoom(fitZoom);
}, []);
```

Pass `onSelect={handleSelect}` to `<Legend>`:

```tsx
<Legend
  entities={small}
  highlightedEntity={highlightedEntity}
  onHighlight={setHighlightedEntity}
  onSelect={handleSelect}
/>
```

**Step 5: Run test — expect pass**

Run: `npx jest --selectProjects unit tests/unit/MapViewer.test.tsx`
Expected: all tests pass.

**Step 6: Commit**

```bash
git add app/(game)/play/Legend.tsx app/(game)/play/MapPanel.tsx tests/unit/MapViewer.test.tsx
git commit -m "feat(map): add legend click-to-zoom with bbox framing"
```

---

## Task 5: Smoke test all fixes in the dev server

**Why:** Visual fixes must be verified in the browser. This is not automatable.

**Step 1: Start the dev server**

Run: `npm run dev`

**Step 2: Verify ocean background (Issue 2 fix)**

- Open `http://localhost:3000/`
- The map projection oval should show light-blue ocean (`#a8d5e2`) behind all country polygons.
- No more magenta/purple void.

**Step 3: Verify label positioning (Issue 1 fix)**

- Entity labels (Anuradhapura, Goths, etc.) should appear centered on their respective polygons, not clustered in the top-left.
- Zoom in to verify labels track correctly with the map.

**Step 4: Verify fast subsequent loads (Issue 4 fix)**

- Switch years in the dropdown. The first load of each year may be slow (cold cache).
- Switch back to a previously loaded year — it should be near-instant.
- Reload the page for the same year — also near-instant (module-level cache persists across requests in the same dev-server process).

**Step 5: Verify legend click-to-zoom (Issue 3 fix)**

- Scroll down to the Entities legend.
- Click any legend item (e.g., a sultanate or small entity).
- The map should pan and zoom to frame that entity.
- Click a different entity — the map should re-center.

**Step 6: Switch to AD 1648 and verify color families**

- Select "AD 1648 — HRE after Westphalia".
- Verify the HRE member states render in related hues with lightness variation.
- Click an HRE member in the legend — the map should zoom to show its small territory.

**Step 7: Stop the server. No code changes from this task.**

---

## Task 6: Resume demo plan — architecture doc update + wrap-up

This task picks up from the original demo plan's Task 5 (architecture doc update) and wrap-up, which were paused when the smoke test surfaced these issues.

**Files:**
- Modify: `chrono-carta-architecture.md`
- Modify: `CLAUDE.md`

**Step 1: Read the architecture doc** to find where it describes the start-screen route.

**Step 2: Add a "Temporary state" note** near that section:

> **Temporary state (as of 2026-05-01):** Until the gameplay start screen lands, `app/(game)/page.tsx` renders a five-year demo of the map viewer (AD 117, AD 1200, AD 1648, AD 1812, AD 1919), driven by a `?year=` query param. See [docs/plans/2026-05-01-landing-demo-map.md](docs/plans/2026-05-01-landing-demo-map.md). This route will be replaced when the gameplay UI phase begins; the demo and `<YearPicker>` are expected to be deleted at that point — they are not a public surface to preserve.

**Step 3: Add a follow-up entry** in the "Pending Follow-Ups" section of `CLAUDE.md`:

> - **Remove landing-page demo** — `app/(game)/page.tsx`, `app/(game)/YearPicker.tsx`, and `lib/demo-years.ts` are a temporary demo (introduced 2026-05-01) and must be deleted when the gameplay start screen is implemented in the gameplay-UI phase. `lib/demo-map-cache.ts` also goes.

**Step 4: Commit**

```bash
git add chrono-carta-architecture.md CLAUDE.md
git commit -m "docs: flag landing-page demo as temporary deviation"
```

---

## Wrap-up

**Verify the branch story reads cleanly:**

Run: `git log --oneline main..HEAD`

Expected (most recent first):
```
docs: flag landing-page demo as temporary deviation
feat(map): add legend click-to-zoom with bbox framing
perf(demo): cache per-year color assignments to eliminate redundant computation
fix(map): position labels with Marker projection instead of raw coordinates
fix(map): add ocean background with Sphere component
feat(demo): render demo map viewer on landing page
feat(demo): add YearPicker client component
feat(demo): add curated demo-year constants module
docs(plans): ...
```

**Drop the pre-plan stash:**

Run: `git stash list` — confirm `stash@{0}` is `wip: landing demo map (pre-plan draft)`
Run: `git stash drop stash@{0}`

---

## Skills referenced

- @superpowers:test-driven-development — Tasks 1, 2, 4 follow red-green TDD.
- @superpowers:verification-before-completion — Task 5 is the verification gate.
- @superpowers:executing-plans — recommended driver for this plan.
