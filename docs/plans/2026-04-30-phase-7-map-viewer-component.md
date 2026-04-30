# Phase 7 — Map Viewer Component Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans. Component tests follow superpowers:test-driven-development with @testing-library/react.

**Goal:** A reusable `MapViewer` Client Component that renders a `geojson_data` blob with permanent labels, hover tooltips, a legend panel of unlabeled entities, pan/zoom controls, and shared highlight state — used by Phase 9 (creation preview) and Phase 12 (gameplay).

**Architecture:** Per architecture §Map Viewer. Built on `react19-simple-maps` with a `Geographies` + `Geography` layout, custom centroid label rendering above a polygon-area threshold, hover state lifted to a `highlightedEntity` parent piece of state. Legend is a sibling component that reads/writes the same state. Layout is map-on-left / legend-on-right desktop, stacked on tablet.

**Tech Stack:** `react19-simple-maps`, `@turf/turf` (centroid + area calculations on rendered polygons), Tailwind for layout, Jest + RTL for component tests. `@types/geojson` is already a devDep from Phase 6 — import named types from `"geojson"` (e.g. `import type { FeatureCollection } from "geojson"`) rather than relying on the global `GeoJSON` namespace, which doesn't auto-globalize under our `module: esnext` / `moduleResolution: bundler` config.

**Why the fork over upstream `react-simple-maps`.** Upstream (`@3.0.0`, last released 2023) declares `react@^16/17/18` peer deps and is effectively unmaintained — installing it under our React 19.2.4 / Next 16 stack requires `--legacy-peer-deps` or an override. `react19-simple-maps` is a maintained fork with proper React 19 peer deps, ESM/CJS/UMD builds (a recent fork release patched a Turbopack-incompatible UMD export), bundled TypeScript types (no separate `@types/` package needed), and the same `ComposableMap` / `Geographies` / `Geography` / `ZoomableGroup` API surface.

**SSR boundary.** The viewer is a Client Component (`"use client"`) for one specific reason: `ZoomableGroup` uses `d3-zoom`, which attaches event listeners to live DOM nodes and reads element dimensions — neither works during server render. The other classic hazard with this library — `Geographies` performing an async URL fetch on the client and producing a hydration mismatch — does not apply here because we always pass `geojson` as an in-memory object loaded server-side from `maps.geojson_data`. Never pass a URL string to `Geographies` in this project.

**Test convention:** All array-index access in test fixtures uses a non-null assertion (e.g. `fixture.features[0]!.properties.color`). The project's `tsconfig.json` enables `noUncheckedIndexedAccess`, so raw `arr[0]` returns `T | undefined`. In tests we authored the fixture and know the shape — `!` is the right call. For dynamic lookups, prefer `features.find(f => f.properties.Name === "…")!` over indexing.

---

## Task 1: Install dependencies

The fork ships its own TypeScript types — no separate `@types/` devDep.

```
npm i react19-simple-maps
```

Sanity-check: confirm `npx tsc --noEmit` is clean and `next build` succeeds with the package installed but unused. If `next build` fails with a Turbopack/UMD error, pin to the latest fork version that declares the fix in its release notes before continuing — this is the one known compatibility hazard with the fork on Next 15.5+ / Next 16.

Commit:
```
git add package.json package-lock.json
git commit -m "chore: add react19-simple-maps for polygon rendering"
```

---

## Task 2: Test fixture for component tests

**Files:**
- Create: `tests/fixtures/map-fixture.json` — small `geojson_data`-shaped file with ~5 features carrying `Name`, `geometry`, `color` (some with `MemberOf`).

Commit:
```
git add tests/fixtures/map-fixture.json
git commit -m "test(fixtures): map viewer rendering fixture"
```

---

## Task 3: `MapViewer` baseline render TDD

**Files:**
- Create: `tests/unit/MapViewer.test.tsx`
- Create: `app/(game)/play/MapViewer.tsx`

**Step 1: Failing test.**

```tsx
import { render, screen } from "@testing-library/react";
import { MapViewer } from "@/app/(game)/play/MapViewer";
import fixture from "../fixtures/map-fixture.json";

describe("MapViewer", () => {
  it("renders one polygon per feature", () => {
    const { container } = render(
      <MapViewer geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const paths = container.querySelectorAll("path[data-entity-name]");
    expect(paths.length).toBe(fixture.features.length);
  });

  it("colors each polygon from its color property", () => {
    const { container } = render(
      <MapViewer geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
    );
    const first = container.querySelector("path[data-entity-name]");
    expect(first?.getAttribute("fill")).toBe(fixture.features[0]!.properties.color);
  });
});
```

**Step 2: Run, watch fail.**

**Step 3: Implement minimal component.**

```tsx
"use client";

import type { FeatureCollection } from "geojson";
import { ComposableMap, Geographies, Geography } from "react19-simple-maps";

export interface MapViewerProps {
  geojson: FeatureCollection;
  centerLat: number;
  centerLng: number;
  zoom: number;
}

export function MapViewer({ geojson, centerLat, centerLng, zoom }: MapViewerProps) {
  return (
    <ComposableMap projection="geoEqualEarth">
      <Geographies geography={geojson}>
        {({ geographies }) =>
          geographies.map((geo) => (
            <Geography
              key={geo.rsmKey}
              geography={geo}
              data-entity-name={geo.properties.Name}
              fill={geo.properties.color}
            />
          ))
        }
      </Geographies>
    </ComposableMap>
  );
}
```

**Step 4: Run, watch pass. Commit.**

```
git add app/(game)/play/MapViewer.tsx tests/unit/MapViewer.test.tsx
git commit -m "feat(map-viewer): baseline polygon rendering with feature colors"
```

---

## Task 4: Hover tooltip TDD

**Step 1: Failing test.**

```tsx
import userEvent from "@testing-library/user-event";

it("shows the entity name on hover", async () => {
  const user = userEvent.setup();
  const { container } = render(
    <MapViewer geojson={fixture} centerLat={0} centerLng={0} zoom={1} />,
  );
  const path = container.querySelector('path[data-entity-name="Foo"]')!;
  await user.hover(path);
  expect(screen.getByRole("tooltip")).toHaveTextContent("Foo");
});
```

**Step 2: Run, watch fail.**

**Step 3: Add hover state + tooltip.** Follow the architecture: parent component owns `highlightedEntity` state, the path's `onMouseEnter` sets it, an absolutely-positioned tooltip reads it.

**Step 4: Run, watch pass. Commit.**

---

## Task 5: Legend panel + cross-highlight TDD

**Files:**
- Create: `app/(game)/play/Legend.tsx`
- Modify: `MapViewer.test.tsx` (add legend interaction tests)

Tests:
- Legend lists every entity whose rendered area is below threshold (use a small threshold so the fixture exercises both sides).
- Hovering a legend item sets `highlightedEntity` and the corresponding polygon gets a highlight class.
- Clicking a legend item updates the viewport center to that entity's centroid.

Implementation:
- Legend takes `geojson`, `highlightedEntity`, `onHighlight`, `onCenterRequested`.
- `MapViewer` and `Legend` are both children of a wrapper component that owns `highlightedEntity` + `viewport` state.

Commit per test as the cycle goes; final commit:
```
git commit -m "feat(map-viewer): legend panel with shared highlight state"
```

---

## Task 6: Permanent labels above area threshold

Use `turf.area` on each rendered polygon's geometry; render a `<text>` element at `turf.centroid(...)` for entities above the threshold. Threshold scales with zoom — a constant `BASE_THRESHOLD` divided by `zoom` works as a starting point.

Tests:
- A feature whose area is above threshold shows a `<text>` with its name.
- A feature whose area is below threshold does not have a `<text>`.
- Legend includes only entities below threshold.

Commit:
```
git commit -m "feat(map-viewer): permanent labels above area threshold, complementary to legend"
```

---

## Task 7: Pan / zoom controls

Visible buttons (plus, minus, reset) over a corner of the map. State (centerLat, centerLng, zoom) lives in the wrapper; controls update it; `MapViewer`'s `<ZoomableGroup>` consumes the state.

Tests:
- Clicking "plus" doubles the zoom factor (or whatever the increment is).
- Clicking "reset" returns to the props-supplied initial center/zoom.

Commit:
```
git commit -m "feat(map-viewer): zoom controls with reset to curator framing"
```

---

## Task 8: Layout — desktop / tablet

Tailwind: `grid grid-cols-[2fr_1fr]` desktop, `flex-col` on `md:` and below. Map container has aspect-ratio so options render below the fold-line on desktop without scrolling.

A simple visual smoke test (RTL renders, container has the expected class) is enough — the actual layout is best validated in the Playwright E2E in Phase 12.

Commit:
```
git commit -m "feat(map-viewer): responsive desktop/tablet layout"
```

---

## Verification before merge

- All component tests green.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` clean.
- Manual local smoke: render `MapViewer` against a real fixture (a Cliopatria slice) on a throwaway page; verify it looks right in a browser. Delete the throwaway page before commit.

## Merge

```
git checkout main
git merge --no-ff phase/7-map-viewer-component-v2 -m "merge: phase 7 — map viewer with legend, labels, controls"
git push origin main
```

The original `phase/7-map-viewer-component` branch (3 commits using upstream `react-simple-maps`) is retained per the branch-retention rule but is not merged. Implementation work for this revised plan happens on `phase/7-map-viewer-component-v2`.
