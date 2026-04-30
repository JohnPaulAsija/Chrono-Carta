import { _resetCliopatriaCache, loadCliopatria } from "@/lib/cliopatria";

const FIXTURE = "tests/fixtures/cliopatria-mini.geojson";

beforeEach(() => _resetCliopatriaCache());

describe("loadCliopatria", () => {
  it("returns the parsed FeatureCollection from disk", async () => {
    const fc = await loadCliopatria(FIXTURE);
    expect(fc.type).toBe("FeatureCollection");
    expect(Array.isArray(fc.features)).toBe(true);
    expect(fc.features.length).toBeGreaterThan(0);
  });

  it("caches the parsed result across calls with the same path", async () => {
    const a = await loadCliopatria(FIXTURE);
    const b = await loadCliopatria(FIXTURE);
    expect(b).toBe(a);
  });
});
