"use client";

import { useRef, useState } from "react";
import { area } from "@turf/area";
import { centroid } from "@turf/centroid";
import type { Feature, Polygon } from "geojson";
import {
  ComposableMap,
  createCoordinates,
  Geographies,
  Geography,
  Marker,
  Sphere,
  ZoomableGroup,
} from "@vnedyalk0v/react19-simple-maps";
import type { MapFeature, MapFeatureCollection } from "./types";

export interface MapViewerProps {
  geojson: MapFeatureCollection;
  center?: [number, number];
  zoom?: number;
  highlightedEntity?: string | null;
  onHighlight?: (name: string | null) => void;
  labeledEntities?: MapFeature[];
}

export function MapViewer({
  geojson,
  center,
  zoom = 1,
  highlightedEntity: controlledHighlight,
  onHighlight,
  labeledEntities,
}: MapViewerProps) {
  const [internalHighlight, setInternalHighlight] = useState<string | null>(
    null,
  );
  const highlightedEntity = controlledHighlight ?? internalHighlight;
  const setHighlightedEntity = onHighlight ?? setInternalHighlight;
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseMove={(e) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      }}
      onMouseLeave={() => setMousePos(null)}
    >
      <ComposableMap projection="geoEqualEarth">
        <ZoomableGroup
          center={center ? createCoordinates(center[0], center[1]) : undefined}
          zoom={zoom}
          data-zoom={zoom}
        >
          <Sphere fill="#a8d5e2" stroke="#ccc" />
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
            const c =
              feature.geometry.type === "MultiPolygon"
                ? centroid(
                    feature.geometry.coordinates
                      .map(
                        (coords) =>
                          ({
                            type: "Feature",
                            geometry: { type: "Polygon", coordinates: coords },
                            properties: {},
                          }) as Feature<Polygon>,
                      )
                      .reduce((best, poly) =>
                        area(poly) > area(best) ? poly : best,
                      ),
                  )
                : centroid(feature);
            const [lng, lat] = c.geometry.coordinates;
            const MAX_LABEL_LENGTH = 18;
            const name = feature.properties.Name;
            const display =
              name.length > MAX_LABEL_LENGTH
                ? name.slice(0, MAX_LABEL_LENGTH - 1) + "…"
                : name;
            return (
              <Marker
                key={`label-${name}`}
                coordinates={createCoordinates(lng!, lat!)}
              >
                <text
                  data-label={name}
                  textAnchor="middle"
                  className="pointer-events-none fill-current text-xs font-medium"
                >
                  {display}
                </text>
              </Marker>
            );
          })}
        </ZoomableGroup>
      </ComposableMap>
      {highlightedEntity && mousePos && (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded bg-black/80 px-2 py-1 text-sm text-white"
          style={{ left: mousePos.x + 12, top: mousePos.y - 8 }}
        >
          {highlightedEntity}
        </div>
      )}
    </div>
  );
}
