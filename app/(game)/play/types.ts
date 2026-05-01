import type { Feature, FeatureCollection, Geometry } from "geojson";

export interface MapFeatureProperties {
  Name: string;
  color: string;
  MemberOf?: string;
}

export type MapFeature = Feature<Geometry, MapFeatureProperties>;
export type MapFeatureCollection = FeatureCollection<
  Geometry,
  MapFeatureProperties
>;
