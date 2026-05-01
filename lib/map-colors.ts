import * as turf from "@turf/turf";
import type { Feature, Polygon, MultiPolygon } from "geojson";
import type { StrippedFeature } from "@/lib/cliopatria";

type PolygonalFeature = Feature<Polygon | MultiPolygon>;

function isPolygonal(f: StrippedFeature): f is StrippedFeature & PolygonalFeature {
  return f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon";
}

const GOLDEN_ANGLE = 137.508;

export interface Hsl {
  h: number;
  s: number;
  l: number;
}

export function generateDistinctColors(n: number, seed = 0): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const h = (seed * 13 + i * GOLDEN_ANGLE) % 360;
    const s = 60 + ((i * 7) % 25);
    const l = 45 + ((i * 11) % 20);
    out.push(hslToHex({ h, s, l }));
  }
  return out;
}

export function hexToHsl(hex: string): Hsl {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) throw new Error(`invalid hex color: ${hex}`);
  const intVal = parseInt(m[1]!, 16);
  const r = ((intVal >> 16) & 0xff) / 255;
  const g = ((intVal >> 8) & 0xff) / 255;
  const b = (intVal & 0xff) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h *= 60;
  }
  return { h, s: s * 100, l: l * 100 };
}

function groupKey(f: StrippedFeature): string {
  const m = f.properties.MemberOf?.trim();
  return m ? `family:${m}` : `solo:${f.properties.Name}`;
}

function generateLightnessVariants(baseHex: string, k: number): string[] {
  const { h, s } = hexToHsl(baseHex);
  if (k === 1) return [baseHex];
  const out: string[] = [];
  for (let i = 0; i < k; i++) {
    const l = 35 + (i * 35) / (k - 1);
    out.push(hslToHex({ h, s, l }));
  }
  return out;
}

function hueDistance(a: string, b: string): number {
  const ha = hexToHsl(a).h;
  const hb = hexToHsl(b).h;
  const d = Math.abs(ha - hb) % 360;
  return Math.min(d, 360 - d);
}

export interface ColoredFeature extends StrippedFeature {
  properties: StrippedFeature["properties"] & { color: string };
}

export function assignColors(features: StrippedFeature[]): ColoredFeature[] {
  const adj = computeAdjacency(features);

  const groups = new Map<string, StrippedFeature[]>();
  for (const f of features) {
    const k = groupKey(f);
    let bucket = groups.get(k);
    if (!bucket) {
      bucket = [];
      groups.set(k, bucket);
    }
    bucket.push(f);
  }

  const groupKeys = Array.from(groups.keys()).sort();
  const baseHues = generateDistinctColors(groupKeys.length);

  const groupPool = new Map<string, string[]>();
  for (let i = 0; i < groupKeys.length; i++) {
    const k = groupKeys[i]!;
    const base = baseHues[i]!;
    const size = groups.get(k)!.length;
    groupPool.set(k, generateLightnessVariants(base, size));
  }

  const assigned = new Map<string, string>();
  const order = features
    .slice()
    .sort(
      (a, b) =>
        adj.get(b.properties.Name)!.size - adj.get(a.properties.Name)!.size,
    );

  for (const f of order) {
    const name = f.properties.Name;
    const key = groupKey(f);
    const usedByNeighbors = new Set<string>();
    for (const n of adj.get(name)!) {
      const c = assigned.get(n);
      if (c) usedByNeighbors.add(c);
    }

    const preferred = groupPool.get(key)!;
    let pick = preferred.find((c) => !usedByNeighbors.has(c));

    if (!pick) {
      const familyBase = preferred[0]!;
      const fallback = groupKeys
        .filter((gk) => gk !== key)
        .flatMap((gk) => groupPool.get(gk)!)
        .sort((a, b) => hueDistance(familyBase, a) - hueDistance(familyBase, b));
      pick = fallback.find((c) => !usedByNeighbors.has(c));
    }

    if (!pick) {
      throw new Error(
        `[map-colors] invariant violated: no free color for "${name}" ` +
          `(neighbors=${adj.get(name)!.size}, pool=${features.length})`,
      );
    }

    assigned.set(name, pick);
  }

  return features.map((f) => ({
    ...f,
    properties: { ...f.properties, color: assigned.get(f.properties.Name)! },
  }));
}

export function hslToHex({ h, s, l }: Hsl): string {
  const sNorm = s / 100;
  const lNorm = l / 100;
  const c = (1 - Math.abs(2 * lNorm - 1)) * sNorm;
  const hPrime = (((h % 360) + 360) % 360) / 60;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;
  if (hPrime < 1) [r1, g1, b1] = [c, x, 0];
  else if (hPrime < 2) [r1, g1, b1] = [x, c, 0];
  else if (hPrime < 3) [r1, g1, b1] = [0, c, x];
  else if (hPrime < 4) [r1, g1, b1] = [0, x, c];
  else if (hPrime < 5) [r1, g1, b1] = [x, 0, c];
  else [r1, g1, b1] = [c, 0, x];
  const m = lNorm - c / 2;
  const r = Math.round((r1 + m) * 255);
  const g = Math.round((g1 + m) * 255);
  const b = Math.round((b1 + m) * 255);
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function computeAdjacency(
  features: StrippedFeature[],
): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const f of features) {
    adj.set(f.properties.Name, new Set());
  }
  for (let i = 0; i < features.length; i++) {
    for (let j = i + 1; j < features.length; j++) {
      const a = features[i]!;
      const b = features[j]!;
      if (!isPolygonal(a) || !isPolygonal(b)) continue;
      // booleanIntersects covers shared-edge and shared-vertex adjacency.
      // Shared-vertex over-counts slightly but the false positives are
      // rare in real data and acceptable for a coloring heuristic.
      if (turf.booleanIntersects(a, b)) {
        adj.get(a.properties.Name)!.add(b.properties.Name);
        adj.get(b.properties.Name)!.add(a.properties.Name);
      }
    }
  }
  return adj;
}
