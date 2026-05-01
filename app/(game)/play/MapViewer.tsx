"use client";

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
}

export function MapViewer({ geojson }: MapViewerProps) {
  return (
    <ComposableMap projection="geoEqualEarth">
      <Geographies geography={geojson}>
        {({ geographies }) =>
          geographies.map((geo, i) => (
            <Geography
              key={geo.properties?.Name ?? String(i)}
              geography={geo}
              data-entity-name={geo.properties?.Name}
              fill={geo.properties?.color}
            />
          ))
        }
      </Geographies>
    </ComposableMap>
  );
}
