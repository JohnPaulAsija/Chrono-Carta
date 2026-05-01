"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

export interface YearPickerOption {
  value: string;
  label: string;
}

export interface YearPickerProps {
  options: YearPickerOption[];
  selected: string;
}

export function YearPicker({ options, selected }: YearPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="font-medium">Year:</span>
      <select
        value={selected}
        disabled={isPending}
        onChange={(e) => {
          const next = e.target.value;
          startTransition(() => {
            router.push(`/?year=${encodeURIComponent(next)}`);
          });
        }}
        className="rounded border border-zinc-300 bg-white px-2 py-1 dark:border-zinc-700 dark:bg-zinc-900"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {isPending ? <span className="text-zinc-500">loading…</span> : null}
    </label>
  );
}
