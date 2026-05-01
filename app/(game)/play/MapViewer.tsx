"use client";

import { useState } from "react";
import { centroid } from "@turf/centroid";
import {
  ComposableMap,
  Geographies,
  Geography,
} from "@vnedyalk0v/react19-simple-maps";
import type { MapFeature, MapFeatureCollection } from "./types";

export interface MapViewerProps {
  geojson: MapFeatureCollection;
  highlightedEntity?: string | null;
  onHighlight?: (name: string | null) => void;
  labeledEntities?: MapFeature[];
}

export function MapViewer({
  geojson,
  highlightedEntity: controlledHighlight,
  onHighlight,
  labeledEntities,
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
            (geographies as unknown as MapFeature[]).map((geo, i) => (
              <Geography
                key={geo.properties.Name ?? String(i)}
                geography={geo}
                data-entity-name={geo.properties.Name}
                data-highlighted={
                  highlightedEntity === geo.properties.Name
                    ? "true"
                    : undefined
                }
                fill={geo.properties.color}
                onMouseEnter={() =>
                  setHighlightedEntity(geo.properties.Name)
                }
                onMouseLeave={() => setHighlightedEntity(null)}
              />
            ))
          }
        </Geographies>
        {labeledEntities?.map((feature) => {
          const c = centroid(feature);
          const [lng, lat] = c.geometry.coordinates;
          return (
            <text
              key={`label-${feature.properties.Name}`}
              data-label={feature.properties.Name}
              x={lng}
              y={lat}
              textAnchor="middle"
              className="pointer-events-none fill-current text-xs font-medium"
            >
              {feature.properties.Name}
            </text>
          );
        })}
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
