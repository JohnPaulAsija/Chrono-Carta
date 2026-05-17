import React from "react";
import type { Feature, FeatureCollection, Geometry } from "geojson";

export function ComposableMap({
  children,
  ...rest
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return <svg data-testid="composable-map" {...rest}>{children}</svg>;
}

export function Geographies({
  geography,
  children,
  ...rest
}: {
  geography: string | FeatureCollection;
  children: (props: {
    geographies: Feature<Geometry>[];
    outline: string;
    borders: string;
  }) => React.ReactNode;
  [key: string]: unknown;
}) {
  const fc = typeof geography === "string" ? null : geography;
  if (!fc) return null;
  return (
    <g data-testid="geographies" {...rest}>
      {children({
        geographies: fc.features,
        outline: "",
        borders: "",
      })}
    </g>
  );
}

export function Geography({
  geography: _geography,
  style,
  ...rest
}: {
  geography: Feature<Geometry>;
  style?: { default?: { pointerEvents?: string } } | unknown;
  [key: string]: unknown;
}) {
  const pointerEvents =
    style &&
    typeof style === "object" &&
    "default" in style &&
    style.default &&
    typeof style.default === "object" &&
    "pointerEvents" in style.default
      ? (style.default as { pointerEvents?: string }).pointerEvents
      : undefined;
  return (
    <path
      {...rest}
      {...(pointerEvents !== undefined
        ? { "data-pointer-events": pointerEvents }
        : {})}
    />
  );
}

export function createCoordinates(lon: number, lat: number): [number, number] {
  return [lon, lat];
}

export function Marker({
  coordinates,
  children,
  ...rest
}: {
  coordinates: [number, number];
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return (
    <g data-testid="marker" data-coordinates={coordinates.join(",")} {...rest}>
      {children}
    </g>
  );
}

export function ZoomableGroup({
  children,
  ...rest
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) {
  return <g data-testid="zoomable-group" {...rest}>{children}</g>;
}
