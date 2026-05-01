"use client";

import { useMemo, useState } from "react";
import { area } from "@turf/area";
import { MapViewer } from "./MapViewer";
import { Legend } from "./Legend";
import type { MapFeature, MapFeatureCollection } from "./types";

export interface MapPanelProps {
  geojson: MapFeatureCollection;
}

const LABEL_AREA_THRESHOLD = 5e10;

function partitionByArea(features: MapFeature[]): {
  large: MapFeature[];
  small: MapFeature[];
} {
  const large: MapFeature[] = [];
  const small: MapFeature[] = [];
  for (const f of features) {
    if (area(f) >= LABEL_AREA_THRESHOLD) {
      large.push(f);
    } else {
      small.push(f);
    }
  }
  return { large, small };
}

export function MapPanel({ geojson }: MapPanelProps) {
  const [highlightedEntity, setHighlightedEntity] = useState<string | null>(
    null,
  );

  const { large, small } = useMemo(
    () => partitionByArea(geojson.features),
    [geojson.features],
  );

  return (
    <div className="flex gap-4">
      <div className="flex-[2]">
        <MapViewer
          geojson={geojson}
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
