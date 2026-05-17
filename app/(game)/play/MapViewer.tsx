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
  ZoomableGroup,
} from "@vnedyalk0v/react19-simple-maps";
import { feature } from "topojson-client";
import landTopology from "world-atlas/land-50m.json";
import countriesTopology from "world-atlas/countries-50m.json";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { FeatureCollection } from "geojson";
import type { MapFeature, MapFeatureCollection } from "./types";

// `world-atlas/land-50m.json` ships untyped; `objects.land` is documented in its README.
const LAND_FEATURES = feature(
  landTopology as unknown as Topology<{ land: GeometryCollection }>,
  (landTopology as unknown as Topology<{ land: GeometryCollection }>).objects
    .land,
) as FeatureCollection;

// Same pattern for modern country borders; `objects.countries` per world-atlas README.
const COUNTRY_BORDERS = feature(
  countriesTopology as unknown as Topology<{ countries: GeometryCollection }>,
  (countriesTopology as unknown as Topology<{ countries: GeometryCollection }>)
    .objects.countries,
) as FeatureCollection;

export interface MapViewerProps {
  geojson: MapFeatureCollection;
  center?: [number, number];
  zoom?: number;
  highlightedEntity?: string | null;
  onHighlight?: (name: string | null) => void;
  labeledEntities?: MapFeature[];
  showBorders?: boolean;
}

export function MapViewer({
  geojson,
  center,
  zoom = 1,
  highlightedEntity: controlledHighlight,
  onHighlight,
  labeledEntities,
  showBorders = false,
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
      className="relative h-full"
      style={{ backgroundColor: "#a8d5e2" }}
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
          <Geographies geography={LAND_FEATURES} data-layer="basemap">
            {({ geographies }) =>
              geographies.map((geo, i) => (
                <Geography
                  key={`land-${i}`}
                  geography={geo}
                  fill="#e8e0c8"
                  stroke="#a89f80"
                  strokeWidth={0.5}
                  style={{
                    default: { outline: "none", pointerEvents: "none" },
                    hover: { outline: "none", pointerEvents: "none" },
                    pressed: { outline: "none", pointerEvents: "none" },
                  }}
                />
              ))
            }
          </Geographies>
          <Geographies geography={geojson} data-layer="political">
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
          {showBorders && (
            <Geographies
              geography={COUNTRY_BORDERS}
              data-layer="modern-borders"
            >
              {({ geographies }) =>
                geographies.map((geo, i) => (
                  <Geography
                    key={`border-${i}`}
                    geography={geo}
                    fill="none"
                    stroke="#333"
                    strokeWidth={0.75}
                    strokeOpacity={0.9}
                    vectorEffect="non-scaling-stroke"
                    style={{
                      default: { outline: "none", pointerEvents: "none" },
                      hover: { outline: "none", pointerEvents: "none" },
                      pressed: { outline: "none", pointerEvents: "none" },
                    }}
                  />
                ))
              }
            </Geographies>
          )}
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
