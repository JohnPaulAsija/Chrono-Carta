import { DEMO_YEARS, findDemoYear, DEFAULT_DEMO_YEAR } from "../../lib/demo-years";

describe("demo-years", () => {
  it("exposes exactly the five curated years in chronological order", () => {
    expect(DEMO_YEARS.map((d) => d.year)).toEqual([117, 1200, 1648, 1812, 1919]);
  });

  it("each entry has a non-empty label and caption", () => {
    for (const d of DEMO_YEARS) {
      expect(d.label.length).toBeGreaterThan(0);
      expect(d.caption.length).toBeGreaterThan(0);
      expect(d.value).toMatch(/^-?\d+$/);
    }
  });

  it("findDemoYear returns the matching entry by value", () => {
    expect(findDemoYear("1812")?.year).toBe(1812);
  });

  it("findDemoYear returns undefined for an unknown value", () => {
    expect(findDemoYear("9999")).toBeUndefined();
    expect(findDemoYear(undefined)).toBeUndefined();
  });

  it("DEFAULT_DEMO_YEAR is the first entry", () => {
    expect(DEFAULT_DEMO_YEAR).toBe(DEMO_YEARS[0]);
  });
});
