import { formatAnswer } from "@/lib/game-state";

// Tests follow architecture §Display Formatting and §Unit Tests.
// Year 0 is rejected per CLAUDE.md §Year representation: there is no
// year 0 in the historical calendar.

describe("formatAnswer — century precision", () => {
  it.each([
    [1507, "16th century AD"],
    [100, "1st century AD"],
    [99, "1st century AD"],
    [1, "1st century AD"],
    [2001, "21st century AD"],
    [-400, "4th century BC"],
    [-1, "1st century BC"],
    [-100, "1st century BC"],
    [-2001, "21st century BC"],
  ])("formats %d as %s", (value, expected) => {
    expect(formatAnswer(value, "century")).toBe(expected);
  });
});

describe("formatAnswer — decade precision", () => {
  it.each([
    [1507, "1500s AD"],
    [1800, "1800s AD"],
    [10, "10s AD"],
    [-400, "400s BC"],
    [-10, "10s BC"],
    [-1, "0s BC"],
  ])("formats %d as %s", (value, expected) => {
    expect(formatAnswer(value, "decade")).toBe(expected);
  });
});

describe("formatAnswer — year precision", () => {
  it.each([
    [1507, "1507 AD"],
    [1, "1 AD"],
    [-400, "400 BC"],
    [-1, "1 BC"],
  ])("formats %d as %s", (value, expected) => {
    expect(formatAnswer(value, "year")).toBe(expected);
  });
});

describe("formatAnswer — ordinal suffixes 1st through 21st", () => {
  // Drives the ordinal helper through every century value the
  // architecture pins. 11th–13th are the irregular ones; everything
  // else follows the last-digit rule.
  it.each([
    [1, "1st"],
    [2, "2nd"],
    [3, "3rd"],
    [4, "4th"],
    [5, "5th"],
    [6, "6th"],
    [7, "7th"],
    [8, "8th"],
    [9, "9th"],
    [10, "10th"],
    [11, "11th"],
    [12, "12th"],
    [13, "13th"],
    [14, "14th"],
    [15, "15th"],
    [16, "16th"],
    [17, "17th"],
    [18, "18th"],
    [19, "19th"],
    [20, "20th"],
    [21, "21st"],
  ])(
    "century %d formats with ordinal %s",
    (centuryNumber, expectedOrdinal) => {
      // Lowest year in century N is (N - 1) * 100 + 1 (handles AD).
      const year = (centuryNumber - 1) * 100 + 1;
      expect(formatAnswer(year, "century")).toBe(
        `${expectedOrdinal} century AD`,
      );
    },
  );
});

describe("formatAnswer — year zero", () => {
  it.each(["century", "decade", "year"] as const)(
    "throws for year 0 with %s precision",
    (precision) => {
      expect(() => formatAnswer(0, precision)).toThrow();
    },
  );
});
