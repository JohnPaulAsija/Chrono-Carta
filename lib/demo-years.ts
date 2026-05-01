export interface DemoYear {
  /** URL-safe string form of the year (signed integer, no zero). */
  value: string;
  /** Signed integer year — positive AD, negative BC. */
  year: number;
  /** Dropdown label. */
  label: string;
  /** Sub-header caption shown when this year is selected. */
  caption: string;
}

export const DEMO_YEARS: readonly DemoYear[] = [
  {
    value: "117",
    year: 117,
    label: "AD 117 — Height of Rome",
    caption: "The Roman Empire at its greatest extent under Trajan.",
  },
  {
    value: "1200",
    year: 1200,
    label: "AD 1200 — Hohenstaufen Holy Roman Empire",
    caption:
      "The HRE at its medieval peak under Henry VI — major duchies grouped as one color family.",
  },
  {
    value: "1648",
    year: 1648,
    label: "AD 1648 — HRE after Westphalia",
    caption:
      "The Holy Roman Empire's post-Westphalia patchwork — hundreds of states sharing a color family.",
  },
  {
    value: "1812",
    year: 1812,
    label: "AD 1812 — Height of Napoleon",
    caption: "Napoleonic Europe on the eve of the Russian campaign.",
  },
  {
    value: "1919",
    year: 1919,
    label: "AD 1919 — Height of the British Empire",
    caption: "The British Empire at its post-WWI territorial peak.",
  },
] as const;

export const DEFAULT_DEMO_YEAR: DemoYear = DEMO_YEARS[0]!;

export function findDemoYear(value: string | undefined): DemoYear | undefined {
  if (value === undefined) return undefined;
  return DEMO_YEARS.find((d) => d.value === value);
}
