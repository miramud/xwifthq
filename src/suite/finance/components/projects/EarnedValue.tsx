"use client";

import { cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { hueHex } from "@/components/workspace/charts";
import { BAND, indexBand, indexText, pctText } from "./earned-value";

/**
 * Percent complete as a small ring - the hatched track is the work not yet
 * done - with the figure beside it. Its accessible name says it in words.
 */
export function ProgressRing({ pctBp, size = 28, stale = false, showText = true }: { pctBp: number | null; size?: number; stale?: boolean; showText?: boolean }) {
  const pct = pctBp === null ? 0 : Math.max(0, Math.min(100, pctBp / 100));
  const stroke = Math.max(3, size / 8);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const label = pctBp === null ? "Percent complete not known" : `${pctText(pctBp)} complete${stale ? ", stale" : ""}`;
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={label} className="shrink-0 -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-neutral-200" />
        {pctBp !== null && pct > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={hueHex(stale ? "slate" : pct >= 100 ? "mint" : "blue")}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(pct / 100) * c} ${c}`}
          />
        )}
      </svg>
      {showText && (
        <span aria-hidden className={cx("text-sm font-semibold tabular-nums", stale ? "text-neutral-500" : "text-neutral-900")}>
          {pctText(pctBp)}
        </span>
      )}
    </span>
  );
}

/**
 * CPI or SPI: the ratio on its band's wash, with the band in words for
 * screen readers. A missing index is a plain dash, not a colour.
 */
export function IndexValue({ name, value, className }: { name: "CPI" | "SPI"; value: number | null | undefined; className?: string }) {
  const band = indexBand(value);
  if (band === null)
    return (
      <span className={cx("text-sm text-neutral-500", className)}>
        –<span className="sr-only">{name} not known yet</span>
      </span>
    );
  return (
    <span className={cx("inline-flex items-center rounded-full px-2 py-0.5 text-[13px] font-semibold tabular-nums", HUE[BAND[band].hue].soft, className)} data-band={band}>
      {indexText(value)}
      <span className="sr-only">
        {" "}
        {name}, {BAND[band].word}
      </span>
    </span>
  );
}
