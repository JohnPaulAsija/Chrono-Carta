# Demo Map Fixes Design

**Date:** 2026-05-01
**Branch:** `feat/landing-demo-map`
**Context:** The landing-page demo (Tasks 1-3, committed) reveals four issues in the existing map rendering layer. All are pre-existing in the Phase 7/8 components, surfaced by wiring them to the demo page with real Cliopatria data.

---

## Issue 1: Labels not positioned on countries

**Root cause:** `MapViewer.tsx` lines 66-81 render `<text x={lng} y={lat}>` inside `ZoomableGroup`. These are raw geographic coordinates, but the SVG context expects projected screen coordinates. The library provides a `Marker` component that handles the projection transform.

**Fix:** Replace the raw `<text>` elements with `<Marker coordinates={createCoordinates(lng, lat)}>` wrapping the `<text>`. The `Marker` component projects geographic coordinates to SVG space automatically.

**Files:** `app/(game)/play/MapViewer.tsx`, `tests/__mocks__/react19-simple-maps.tsx` (add `Marker` mock), `tests/unit/MapViewer.test.tsx` (update label tests if any).

---

## Issue 2: No ocean background (purple/magenta fill)

**Root cause:** `ComposableMap` has no ocean/globe background. The library provides a `<Sphere>` component that renders the projected globe outline with a configurable fill. Without it, the largest Cliopatria polygon visually dominates and looks like water.

**Fix:** Add `<Sphere fill="#a8d5e2" stroke="#ccc" />` inside `ComposableMap`, before `ZoomableGroup`. This gives the globe a light-blue ocean fill that sits behind all geographies.

**Files:** `app/(game)/play/MapViewer.tsx`, `tests/__mocks__/react19-simple-maps.tsx` (add `Sphere` mock).

---

## Issue 3: Legend items look clickable but do nothing

**Root cause:** `Legend.tsx` has `cursor-pointer` CSS and hover-highlight sync, but no `onClick`. Users expect clicking to do something.

**Fix:** Add click-to-zoom. When a legend item is clicked, compute the entity's bounding box with `@turf/bbox`, derive a center + zoom level that frames the entity, and update `MapPanel` state. This requires:
- A new `onSelect` callback prop on `Legend` that receives the clicked `MapFeature`.
- `MapPanel` handles the callback by computing bbox, deriving center/zoom, and updating state.
- `Legend` wires `onClick` to call `onSelect`.

`@turf/bbox` is a lightweight function (no geometry intersection) — cheap to run on click.

**Files:** `app/(game)/play/Legend.tsx`, `app/(game)/play/MapPanel.tsx`, `tests/unit/MapViewer.test.tsx` (legend interaction tests).

---

## Issue 4: Slow load times from repeated color assignment

**Root cause:** `assignColors` runs O(n^2) `booleanIntersects` checks (Turf.js) on every request. The Cliopatria dataset is cached after first parse, but color assignment re-runs each time a year is requested.

**Fix:** Cache the fully processed `MapFeatureCollection` per year value in a module-level `Map<string, MapFeatureCollection>` in `page.tsx` (or a small helper). First request per year pays the cost; subsequent requests return instantly. With only 5 demo years, total memory is trivial (~2-5 MB for all cached results).

**Files:** `app/(game)/page.tsx` (add cache around the filter-strip-color pipeline).

---

## Implementation order

1. **Ocean background** (Issue 2) — smallest change, biggest visual improvement
2. **Label positioning** (Issue 1) — swap `<text>` for `<Marker>`, update mock
3. **Color cache** (Issue 4) — cache per-year results in page module
4. **Legend click-to-zoom** (Issue 3) — new callback plumbing, bbox computation

Issues 1-3 modify existing Phase 7/8 components. Issue 4 modifies the demo page from this branch. All changes stay on `feat/landing-demo-map`.

## Testing approach

- Issues 1-2: Update existing `MapViewer.test.tsx` + mock. TDD for new `Sphere`/`Marker` rendering.
- Issue 3: TDD for legend click behavior + MapPanel zoom-to-entity.
- Issue 4: No unit test (caching is an implementation detail of the server component; verified by smoke test showing fast subsequent loads).
