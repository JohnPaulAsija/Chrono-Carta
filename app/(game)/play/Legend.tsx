"use client";

import { useMemo, useState } from "react";
import { area } from "@turf/area";
import type { MapFeature } from "./types";

type SortOrder = "name" | "size";

export interface LegendProps {
  entities: MapFeature[];
  highlightedEntity: string | null;
  onHighlight: (name: string | null) => void;
  onSelect?: (feature: MapFeature) => void;
}

export function Legend({
  entities,
  highlightedEntity,
  onHighlight,
  onSelect,
}: LegendProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("size");

  const sorted = useMemo(() => {
    const copy = [...entities];
    if (sortOrder === "name") {
      copy.sort((a, b) => a.properties.Name.localeCompare(b.properties.Name));
    } else {
      copy.sort((a, b) => area(b) - area(a));
    }
    return copy;
  }, [entities, sortOrder]);

  return (
    <aside role="complementary" className="space-y-1 p-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Entities</h3>
        <button
          type="button"
          className="text-xs text-gray-500 hover:text-gray-800"
          onClick={() =>
            setSortOrder((s) => (s === "name" ? "size" : "name"))
          }
        >
          Sort: {sortOrder === "name" ? "A–Z" : "Size"}
        </button>
      </div>
      <ul>
        {sorted.map((feature) => {
          const { Name: name, color } = feature.properties;
          const isHighlighted = highlightedEntity === name;
          return (
            <li
              key={name}
              data-highlighted={isHighlighted ? "true" : undefined}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-gray-100"
              onMouseEnter={() => onHighlight(name)}
              onMouseLeave={() => onHighlight(null)}
              onClick={() => onSelect?.(feature)}
            >
              <span
                className="inline-block h-3 w-3 rounded-sm"
                style={{ backgroundColor: color }}
              />
              {name}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
