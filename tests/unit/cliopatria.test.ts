import { existsSync } from "node:fs";

import {
  _resetCliopatriaCache,
  filterByYear,
  loadCliopatria,
  stripYearData,
} from "@/lib/cliopatria";

const FIXTURE = "tests/fixtures/cliopatria-mini.geojson";
const REAL_DATASET = "public/data/cliopatria-0.0.1/cliopatria.geojson";

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

describe("stripYearData", () => {
  it("preserves Name and geometry exactly", async () => {
    const fc = await loadCliopatria(FIXTURE);
    const atlantis = fc.features.find((f) => f.properties.Name === "Atlantis")!;
    const stripped = stripYearData([atlantis]);
    const first = stripped[0]!;
    expect(first.type).toBe("Feature");
    expect(first.properties.Name).toBe("Atlantis");
    expect(first.geometry).toEqual(atlantis.geometry);
  });

  it("drops every leak-prone auxiliary field", async () => {
    const fc = await loadCliopatria(FIXTURE);
    const atlantis = fc.features.find((f) => f.properties.Name === "Atlantis")!;
    const props = stripYearData([atlantis])[0]!.properties;
    for (const key of [
      "FromYear",
      "ToYear",
      "Area",
      "Wikipedia",
      "SeshatID",
      "Type",
      "Components",
    ]) {
      expect(props).not.toHaveProperty(key);
    }
  });

  it("preserves MemberOf when present", async () => {
    const fc = await loadCliopatria(FIXTURE);
    const empyrea = fc.features.find((f) => f.properties.Name === "Empyrea")!;
    expect(stripYearData([empyrea])[0]!.properties).toEqual({
      Name: "Empyrea",
      MemberOf: "Hapsburg Sphere",
    });
  });

  it("omits MemberOf when the feature has none", async () => {
    const fc = await loadCliopatria(FIXTURE);
    const boundaria = fc.features.find(
      (f) => f.properties.Name === "Boundaria",
    )!;
    const props = stripYearData([boundaria])[0]!.properties;
    expect(props).toEqual({ Name: "Boundaria" });
    expect(props).not.toHaveProperty("MemberOf");
  });
});

const realDatasetPresent = existsSync(REAL_DATASET);
const describeWithRealDataset = realDatasetPresent ? describe : describe.skip;

describeWithRealDataset("real cliopatria dataset", () => {
  it("parses without error and contains thousands of features", async () => {
    const fc = await loadCliopatria();
    expect(fc.features.length).toBeGreaterThan(1000);
  });

  it("filterByYear(1815) returns a non-empty subset", async () => {
    const fc = await loadCliopatria();
    expect(filterByYear(fc.features, 1815).length).toBeGreaterThan(0);
  });
});
