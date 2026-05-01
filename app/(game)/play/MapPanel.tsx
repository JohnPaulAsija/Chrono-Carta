"use client";

import { useCallback, useMemo, useState } from "react";
import { area } from "@turf/area";
import { MapViewer } from "./MapViewer";
import { Legend } from "./Legend";
import { ZoomControls } from "./ZoomControls";
import type { MapFeature, MapFeatureCollection } from "./types";

export interface MapPanelProps {
  geojson: MapFeatureCollection;
  initialCenter?: [number, number];
  initialZoom?: number;
}

const LABEL_AREA_THRESHOLD = 5e10;
const ZOOM_STEP = 2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 32;

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

export function MapPanel({
  geojson,
  initialCenter = [0, 0],
  initialZoom = 1,
}: MapPanelProps) {
  const [highlightedEntity, setHighlightedEntity] = useState<string | null>(
    null,
  );
  const [center, setCenter] = useState<[number, number]>(initialCenter);
  const [zoom, setZoom] = useState(initialZoom);

  const { large, small } = useMemo(
    () => partitionByArea(geojson.features),
    [geojson.features],
  );

  const handleZoomIn = useCallback(
    () => setZoom((z) => Math.min(z * ZOOM_STEP, MAX_ZOOM)),
    [],
  );
  const handleZoomOut = useCallback(
    () => setZoom((z) => Math.max(z / ZOOM_STEP, MIN_ZOOM)),
    [],
  );
  const handleReset = useCallback(() => {
    setCenter(initialCenter);
    setZoom(initialZoom);
  }, [initialCenter, initialZoom]);

  return (
    <div className="flex gap-4">
      <div className="relative flex-[2]">
        <MapViewer
          geojson={geojson}
          center={center}
          zoom={zoom}
          highlightedEntity={highlightedEntity}
          onHighlight={setHighlightedEntity}
          labeledEntities={large}
        />
        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleReset}
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
