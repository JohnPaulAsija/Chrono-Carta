"use client";

export interface ZoomControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}

export function ZoomControls({ onZoomIn, onZoomOut, onReset }: ZoomControlsProps) {
  return (
    <div className="absolute right-2 bottom-2 flex flex-col gap-1">
      <button
        type="button"
        aria-label="Zoom in"
        onClick={onZoomIn}
        className="rounded bg-white/90 px-2 py-1 text-sm shadow hover:bg-white"
      >
        +
      </button>
      <button
        type="button"
        aria-label="Zoom out"
        onClick={onZoomOut}
        className="rounded bg-white/90 px-2 py-1 text-sm shadow hover:bg-white"
      >
        −
      </button>
      <button
        type="button"
        aria-label="Reset view"
        onClick={onReset}
        className="rounded bg-white/90 px-2 py-1 text-sm shadow hover:bg-white"
      >
        ⌂
      </button>
    </div>
  );
}
