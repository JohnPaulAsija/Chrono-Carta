"use client";

import { useState } from "react";
import type { FeatureCollection } from "geojson";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "@vnedyalk0v/react19-simple-maps";

export interface MapViewerProps {
  geojson: FeatureCollection;
  centerLat: number;
  centerLng: number;
  zoom: number;
  highlightedEntity?: string | null;
  onHighlight?: (name: string | null) => void;
}

export function MapViewer({
  geojson,
  highlightedEntity: controlledHighlight,
  onHighlight,
}: MapViewerProps) {
  const [internalHighlight, setInternalHighlight] = useState<string | null>(
    null,
  );
  const highlightedEntity = controlledHighlight ?? internalHighlight;
  const setHighlightedEntity = onHighlight ?? setInternalHighlight;

  return (
    <div className="relative">
      <ComposableMap projection="geoEqualEarth">
        <Geographies geography={geojson}>
          {({ geographies }) =>
            geographies.map((geo, i) => (
              <Geography
                key={geo.properties?.Name ?? String(i)}
                geography={geo}
                data-entity-name={geo.properties?.Name}
                data-highlighted={
                  highlightedEntity === geo.properties?.Name
                    ? "true"
                    : undefined
                }
                fill={geo.properties?.color}
                onMouseEnter={() =>
                  setHighlightedEntity(geo.properties?.Name ?? null)
                }
                onMouseLeave={() => setHighlightedEntity(null)}
              />
            ))
          }
        </Geographies>
      </ComposableMap>
      {highlightedEntity && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-2 left-2 rounded bg-black/80 px-2 py-1 text-sm text-white"
        >
          {highlightedEntity}
        </div>
      )}
    </div>
  );
}
