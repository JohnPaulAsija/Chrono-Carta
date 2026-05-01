"use client";

import { useMemo, useState } from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import * as turf from "@turf/turf";
import { MapViewer } from "./MapViewer";
import { Legend } from "./Legend";

export interface MapPanelProps {
  geojson: FeatureCollection;
  centerLat: number;
  centerLng: number;
  zoom: number;
}

const LABEL_AREA_THRESHOLD = 5e10;

function partitionByArea(features: Feature<Geometry>[]): {
  large: Feature<Geometry>[];
  small: Feature<Geometry>[];
} {
  const large: Feature<Geometry>[] = [];
  const small: Feature<Geometry>[] = [];
  for (const f of features) {
    const a = turf.area(f);
    if (a >= LABEL_AREA_THRESHOLD) {
      large.push(f);
    } else {
      small.push(f);
    }
  }
  return { large, small };
}

export function MapPanel({ geojson, centerLat, centerLng, zoom }: MapPanelProps) {
  const [highlightedEntity, setHighlightedEntity] = useState<string | null>(
    null,
  );

  const { large, small } = useMemo(
    () => partitionByArea(geojson.features as Feature<Geometry>[]),
    [geojson.features],
  );

  return (
    <div className="flex gap-4">
      <div className="flex-[2]">
        <MapViewer
          geojson={geojson}
          centerLat={centerLat}
          centerLng={centerLng}
          zoom={zoom}
          highlightedEntity={highlightedEntity}
          onHighlight={setHighlightedEntity}
          labeledEntities={large}
        />
      </div>
      <div className="flex-1">
        <Legend
          entities={small}
          highlightedEntity={highlightedEntity}
          onHighlight={setHighlightedEntity}
        />
      </div>
    </div>
  );
}
