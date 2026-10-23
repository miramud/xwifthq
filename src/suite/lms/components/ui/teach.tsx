"use client";

import { cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";

/**
 * A compact progress meter for table cells and list rows: the workspace's
 * hatched track, with its name given to assistive tech only. The kit's
 * `Progress` prints its label above the bar, which is right in a card and
 * wrong in a 90px table column.
 */
export function Meter({
  value,
  label,
  hue = "blue",
  size = "sm",
  className,
}: {
  value: number;
  /** Accessible name, not shown. */
  label: string;
  hue?: Hue;
  size?: "sm" | "md";
  className?: string;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cx("ws-hatch w-full overflow-hidden rounded-full", size === "sm" ? "h-1.5" : "h-2.5", className)}
    >
      <div className={cx("h-full rounded-full transition-[width] duration-500", HUE[hue].bar)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Colour a learner's progress: amber when barely started, blue mid-way, mint near done. */
export function progressHue(v: number): Hue {
  return v >= 75 ? "mint" : v >= 40 ? "blue" : "sun";
}
