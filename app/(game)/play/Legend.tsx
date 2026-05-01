"use client";

import type { MapFeature } from "./types";

export interface LegendProps {
  entities: MapFeature[];
  highlightedEntity: string | null;
  onHighlight: (name: string | null) => void;
}

export function Legend({ entities, highlightedEntity, onHighlight }: LegendProps) {
  return (
    <aside role="complementary" className="space-y-1 p-2">
      <h3 className="text-sm font-semibold">Entities</h3>
      <ul>
        {entities.map((feature) => {
          const { Name: name, color } = feature.properties;
          const isHighlighted = highlightedEntity === name;
          return (
            <li
              key={name}
              data-highlighted={isHighlighted ? "true" : undefined}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-gray-100"
              onMouseEnter={() => onHighlight(name)}
              onMouseLeave={() => onHighlight(null)}
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
