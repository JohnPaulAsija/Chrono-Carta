import {
  _resetCliopatriaCache,
  filterByYear,
  loadCliopatria,
} from "@/lib/cliopatria";

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

describe("filterByYear", () => {
  it("includes a feature whose range spans the year", async () => {
    const fc = await loadCliopatria(FIXTURE);
    const names = filterByYear(fc.features, 1815).map((f) => f.properties.Name);
    expect(names).toContain("Atlantis");
    expect(names).toContain("Empyrea");
  });

  it("includes features at the inclusive lower bound (FromYear === year)", async () => {
    const fc = await loadCliopatria(FIXTURE);
    const names = filterByYear(fc.features, 1815).map((f) => f.properties.Name);
    expect(names).toContain("Boundaria");
  });

  it("includes features at the inclusive upper bound (ToYear === year)", async () => {
    const fc = await loadCliopatria(FIXTURE);
    const names = filterByYear(fc.features, 1815).map((f) => f.properties.Name);
    expect(names).toContain("Cessation");
  });

  it("excludes features outside the range", async () => {
    const fc = await loadCliopatria(FIXTURE);
    const names = filterByYear(fc.features, 1815).map((f) => f.properties.Name);
    expect(names).not.toContain("Distantia");
  });

  it("returns an empty array when no features overlap", () => {
    expect(filterByYear([], 1815)).toEqual([]);
  });
});
