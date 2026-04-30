// Display formatting for map answers. Runs at map creation time only
// (architecture §Display Formatting) — the result is stored in
// `formatted_correct` / `formatted_wrong` and the raw integer never
// reaches the client during gameplay.
//
// Years are signed: positive AD, negative BC. Year 0 is rejected per
// the historical calendar (1 BC is followed immediately by 1 AD).

export type Precision = "century" | "decade" | "year";

export function formatAnswer(value: number, precision: Precision): string {
  if (value === 0) {
    throw new Error(
      "formatAnswer: year 0 is not a valid year (1 BC is followed by 1 AD)",
    );
  }

  const era = value > 0 ? "AD" : "BC";
  const absValue = Math.abs(value);

  switch (precision) {
    case "century": {
      const century = Math.ceil(absValue / 100);
      return `${ordinal(century)} century ${era}`;
    }
    case "decade": {
      const decade = Math.floor(absValue / 10) * 10;
      return `${decade}s ${era}`;
    }
    case "year": {
      return `${absValue} ${era}`;
    }
  }
}

// Ordinal suffix for positive integers. Handles the 11/12/13 irregular
// teens before falling through to the last-digit rule.
function ordinal(n: number): string {
  const lastTwo = n % 100;
  if (lastTwo >= 11 && lastTwo <= 13) {
    return `${n}th`;
  }
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
