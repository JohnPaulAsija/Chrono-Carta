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
