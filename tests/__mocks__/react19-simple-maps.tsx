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
}: {
  geography: string | FeatureCollection;
  children: (props: {
    geographies: Feature<Geometry>[];
    outline: string;
    borders: string;
  }) => React.ReactNode;
}) {
  const fc = typeof geography === "string" ? null : geography;
  if (!fc) return null;
  return (
    <g data-testid="geographies">
      {children({
        geographies: fc.features,
        outline: "",
        borders: "",
      })}
    </g>
  );
}

export function Geography({
  geography,
  style: _style,
  ...rest
}: {
  geography: Feature<Geometry>;
  style?: unknown;
  [key: string]: unknown;
}) {
  return <path {...rest} />;
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
