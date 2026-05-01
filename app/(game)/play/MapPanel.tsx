"use client";

import { useCallback, useMemo, useState } from "react";
import { area } from "@turf/area";
import { bbox } from "@turf/bbox";
import { MapViewer } from "./MapViewer";
import { Legend } from "./Legend";
import { ZoomControls } from "./ZoomControls";
import type { MapFeature, MapFeatureCollection } from "./types";

export interface MapPanelProps {
  geojson: MapFeatureCollection;
  initialCenter?: [number, number];
  initialZoom?: number;
}

const MAX_LABELS = 3;
const ZOOM_STEP = 2;
const MIN_ZOOM = 1;
const MAX_ZOOM = 32;

function topByArea(features: MapFeature[], n: number): MapFeature[] {
  return [...features].sort((a, b) => area(b) - area(a)).slice(0, n);
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

  const labeled = useMemo(
    () => topByArea(geojson.features, MAX_LABELS),
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

  return (
    <div className="grid grid-cols-[65%_1fr] gap-4">
      <div className="relative h-[45vh]">
        <MapViewer
          geojson={geojson}
          center={center}
          zoom={zoom}
          highlightedEntity={highlightedEntity}
          onHighlight={setHighlightedEntity}
          labeledEntities={labeled}
        />
        <ZoomControls
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onReset={handleReset}
        />
      </div>
      <div className="h-[45vh] overflow-y-auto">
        <Legend
          entities={geojson.features}
          highlightedEntity={highlightedEntity}
          onHighlight={setHighlightedEntity}
          onSelect={handleSelect}
        />
      </div>
    </div>
  );
}
