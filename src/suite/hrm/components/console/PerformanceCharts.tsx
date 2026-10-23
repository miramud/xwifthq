"use client";

/* ------------------------------------------------------------------ */
/*  Charts for the HR performance reports.                             */
/*                                                                     */
/*  Dependency-free SVG, matching the LMS progress charts. Three        */
/*  shapes, and each exists because the obvious alternative lies.       */
/* ------------------------------------------------------------------ */

import { useId, useState } from "react";
import type { KpiPoint } from "@/lib/api/hrm-client";
import { hueHex } from "@/components/workspace/charts";
import { HUE, type Hue } from "@/components/workspace/modules";

/* ================================================================== */
/*  A KPI over time                                                    */
/* ================================================================== */

/**
 * Readings plotted against the target.
 *
 * Three decisions, all of them about not lying:
 *
 * **The target is a line, drawn from each point's own target.** Carrying it
 * per point rather than as one horizontal rule means a target revised
 * mid-period shows as a step. Drawn as a rule, the same chart would show
 * readings measured against a bar that was never in force when they were
 * taken.
 *
 * **Points are placed by index, not by date, and the axis says so.** A KPI
 * measured weekly then daily would otherwise bunch, and stretching an x-axis
 * over real time invites reading a slope as a rate. The dates are on the
 * labels; the line joins observations, and nothing between two points is
 * claimed to have been observed.
 *
 * **Direction decides the colour.** Rising is only good when higher is
 * better. A chart that greens every upward slope is wrong for a third of real
 * KPIs — average handling time, defect rate, days to close.
 */
export function KpiSeriesChart({
  data,
  direction,
  unit,
  height = 200,
  ariaLabel,
}: {
  data: KpiPoint[];
  direction: "higher" | "lower";
  unit?: string | null;
  height?: number;
  ariaLabel?: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">
        Nothing measured yet.
      </p>
    );
  }

  const W = 720;
  const H = height;
  const padX = 10;
  const padTop = 14;
  const padBottom = 28;
  const plotH = H - padTop - padBottom;

  const values = data.map((d) => d.value);
  const targets = data.map((d) => d.target);
  const max = Math.max(...values, ...targets, 1);
  const min = Math.min(...values, ...targets, 0);
  const span = max - min || 1;

  const x = (i: number) =>
    data.length === 1
      ? W / 2
      : padX + (i / (data.length - 1)) * (W - padX * 2);

  const y = (value: number) => padTop + plotH - ((value - min) / span) * plotH;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.value)}`).join(" ");
  const area = `${line} L${x(data.length - 1)},${padTop + plotH} L${x(0)},${padTop + plotH} Z`;
  const targetLine = data
    .map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d.target)}`)
    .join(" ");

  const latest = data[data.length - 1];
  const onTrack =
    direction === "higher" ? latest.value >= latest.target : latest.value <= latest.target;

  const stroke = hueHex(onTrack ? "mint" : "sun");

  const shown = hover === null ? data.length - 1 : hover;
  const point = data[shown];

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={ariaLabel ?? "Readings against the target over time"}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((f) => (
          <line
            key={f}
            x1={0}
            x2={W}
            y1={padTop + plotH * f}
            y2={padTop + plotH * f}
            stroke="currentColor"
            className="text-neutral-100"
            strokeWidth="1"
          />
        ))}

        <path d={area} fill={`url(#${gradientId})`} />

        {/*
          The target, dashed and drawn from each point's own value — a
          revision mid-period is a visible step rather than a silent rescale.
        */}
        <path
          d={targetLine}
          fill="none"
          stroke={hueHex("slate")}
          strokeOpacity="0.7"
          strokeWidth="1.5"
          strokeDasharray="5 4"
        />

        <path d={line} fill="none" stroke={stroke} strokeWidth="2.5" strokeLinejoin="round" />

        {data.map((d, i) => (
          <g key={d.date}>
            <circle
              cx={x(i)}
              cy={y(d.value)}
              r={i === shown ? 5 : 3.5}
              fill="white"
              stroke={stroke}
              strokeWidth="2"
            />
            {/* A generous hit area — the dots themselves are too small to aim at. */}
            <rect
              x={x(i) - 16}
              y={padTop}
              width={32}
              height={plotH}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          </g>
        ))}

        {/* Only the first and last labels: a dense axis is unreadable at this width. */}
        <text x={x(0)} y={H - 8} className="fill-neutral-500 text-[11px]" textAnchor="start">
          {data[0].label}
        </text>
        {data.length > 1 && (
          <text
            x={x(data.length - 1)}
            y={H - 8}
            className="fill-neutral-500 text-[11px]"
            textAnchor="end"
          >
            {data[data.length - 1].label}
          </text>
        )}
      </svg>

      <div className="mt-1 flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="text-neutral-500">
          {point.label}
          {": "}
          <span className="font-semibold text-neutral-900 tnum">
            {point.value}
            {unit ? ` ${unit}` : ""}
          </span>
          <span className="text-neutral-500">
            {" "}
            against {point.target}
            {unit ? ` ${unit}` : ""}
          </span>
        </span>
        <span
          className={`rounded-full px-2 py-0.5 font-semibold tnum ${onTrack ? "bg-mint-50 text-mint-700" : "bg-sun-50 text-sun-700"}`}
        >
          {point.attainment}%
        </span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Attainment spread across a cohort                                  */
/* ================================================================== */

/**
 * How many people fall in each attainment band.
 *
 * Bands rather than a histogram of raw values, because the boundaries are
 * where a manager's reaction changes: under half is a problem, 50–80 is
 * behind, 80–100 is on track, 100–120 is met, above that is well past.
 */
export function AttainmentDistribution({
  bands,
}: {
  bands: { label: string; people: number; share: number }[];
}) {
  const max = Math.max(1, ...bands.map((b) => b.people));

  const tone = (label: string): string => HUE[bandHue(label)].bar;

  return (
    <dl className="space-y-3.5">
      {bands.map((band) => (
        <div key={band.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <dt className="flex items-center gap-2 font-medium text-neutral-700">
              <span className={`h-2 w-2 rounded-full ${HUE[bandHue(band.label)].dot}`} aria-hidden />
              {band.label}
            </dt>
            <dd className="shrink-0 text-neutral-500">
              <span className="font-semibold text-neutral-900 tnum">{band.people}</span>
              <span className="ml-1 tnum">({band.share}%)</span>
            </dd>
          </div>
          <div className="ws-hatch h-3 overflow-hidden rounded-full">
            <div
              className={`h-full rounded-full transition-all duration-700 ${tone(band.label)}`}
              style={{ width: `${(band.people / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </dl>
  );
}

/** The hue a manager's reaction attaches to each attainment band. */
export function bandHue(label: string): Hue {
  if (label.startsWith("Under")) return "rose";
  if (label.startsWith("50")) return "sun";
  if (label.startsWith("80")) return "sky";
  return "mint";
}

/* ================================================================== */
/*  Rating history                                                     */
/* ================================================================== */

/**
 * Self rating against manager rating, cycle by cycle.
 *
 * Two bars per cycle, never one averaged bar. The *gap* is the most
 * actionable thing in an appraisal — somebody rating themselves 5 against a
 * manager's 2 is a conversation that has not happened — and a mean of 3.5
 * destroys it while looking like information.
 */
export function RatingHistory({
  reviews,
}: {
  reviews: {
    id: string;
    label: string;
    selfRating: number | null;
    managerRating: number | null;
    gap: number | null;
  }[];
}) {
  if (reviews.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        No completed reviews yet.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {reviews.map((review) => (
          <li key={review.id} className="space-y-1.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-xs font-medium text-neutral-700">
                {review.label}
              </span>
              {review.gap !== null && review.gap !== 0 && (
                <span
                  className={`shrink-0 text-[11px] tnum ${
                    Math.abs(review.gap) >= 2
                      ? "rounded-full bg-coral-50 px-2 py-0.5 font-semibold text-coral-700"
                      : "text-neutral-500"
                  }`}
                >
                  {review.gap > 0 ? "+" : ""}
                  {review.gap} gap
                </span>
              )}
            </div>

            <div className="space-y-1">
              <RatingBar label="Them" value={review.selfRating} tone={HUE.sky.bar} />
              <RatingBar label="Manager" value={review.managerRating} tone={HUE.grape.bar} />
            </div>
          </li>
        ))}
      </ul>

      <p className="text-[11px] text-neutral-500">
        Shown separately on purpose. The difference between the two is the part
        worth talking about, and an average of them is not.
      </p>
    </div>
  );
}

function RatingBar({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | null;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-14 shrink-0 text-[11px] text-neutral-500">{label}</span>
      <div className="ws-hatch h-2 flex-1 overflow-hidden rounded-full">
        <div
          className={`h-full rounded-full ${tone}`}
          /* Null renders as an empty track — not rated is not the same as 0. */
          style={{ width: value === null ? "0%" : `${(value / 5) * 100}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right text-[11px] text-neutral-600 tnum">
        {value === null ? "-" : `${value}/5`}
      </span>
    </div>
  );
}
