"use client";

/* ------------------------------------------------------------------ */
/*  Charts for the progress reports.                                   */
/*                                                                     */
/*  Dependency-free SVG, like components/console/Charts.tsx — but these */
/*  three shapes are specific to progress and none of them is an area   */
/*  chart, so they live here rather than being bent out of that file.   */
/* ------------------------------------------------------------------ */

import { useId, useState } from "react";
import type { LectureFunnelRow, ProgressBand, ProgressPoint } from "@/lib/api/progress-client";

/* ================================================================== */
/*  Cumulative progress line                                           */
/* ================================================================== */

/**
 * Lectures finished over time, as a running total with a daily bar.
 *
 * Two series on one frame because they answer two halves of one question:
 * the line is how far they have got, the bars are whether they are still
 * moving. Either alone is misleading — a line that has flattened looks
 * identical to one that is climbing slowly.
 *
 * Backfilled days are hatched rather than dropped. Those completions have no
 * real timestamp (they predate per-lecture logging and all carry one date),
 * so showing them as measured activity would invent a spike, and hiding them
 * would make the running total appear to jump for no reason.
 */
export function ProgressSeriesChart({
  data,
  height = 220,
  ariaLabel,
}: {
  data: ProgressPoint[];
  height?: number;
  ariaLabel?: string;
}) {
  const clipId = useId();
  const hatchId = useId();
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-neutral-500">
        No activity recorded yet.
      </p>
    );
  }

  const W = 720;
  const H = height;
  const padX = 8;
  const padTop = 12;
  const padBottom = 26;
  const plotH = H - padTop - padBottom;

  const maxCumulative = Math.max(1, ...data.map((d) => d.cumulative));
  const maxDaily = Math.max(1, ...data.map((d) => d.completed + d.backfilled));

  const step = (W - padX * 2) / Math.max(1, data.length - 1);
  const x = (i: number) => padX + i * step;
  const yLine = (v: number) => padTop + plotH - (v / maxCumulative) * plotH;

  // Bars share the frame at a third of its height, so they read as a
  // secondary series rather than competing with the line.
  const barZone = plotH / 3;
  const barW = Math.max(2, Math.min(14, step * 0.55));
  const barH = (v: number) => (v / maxDaily) * barZone;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)},${yLine(d.cumulative)}`)
    .join(" ");

  const areaPath = `${linePath} L ${x(data.length - 1)},${padTop + plotH} L ${x(0)},${
    padTop + plotH
  } Z`;

  // Roughly six labels, whatever the window length.
  const labelEvery = Math.max(1, Math.ceil(data.length / 6));

  const active = hover === null ? null : data[hover];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={ariaLabel ?? "Lectures completed over time"}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={0} y={0} width={W} height={H} />
          </clipPath>
          <pattern
            id={hatchId}
            width="5"
            height="5"
            patternTransform="rotate(45)"
            patternUnits="userSpaceOnUse"
          >
            <line x1="0" y1="0" x2="0" y2="5" stroke="#94a3b8" strokeWidth="2" />
          </pattern>
          <linearGradient id={`${clipId}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0c4f54" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#0c4f54" stopOpacity="0" />
          </linearGradient>
        </defs>

        <g clipPath={`url(#${clipId})`}>
          <path d={areaPath} fill={`url(#${clipId}-fill)`} />
          <path
            d={linePath}
            fill="none"
            stroke="#0c4f54"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {data.map((d, i) => {
            const measured = barH(d.completed);
            const filled = barH(d.backfilled);
            const base = padTop + plotH;

            return (
              <g key={d.date}>
                {d.completed > 0 && (
                  <rect
                    x={x(i) - barW / 2}
                    y={base - measured}
                    width={barW}
                    height={measured}
                    rx={1.5}
                    fill="#0ea5e9"
                    opacity={hover === null || hover === i ? 0.9 : 0.35}
                  />
                )}
                {d.backfilled > 0 && (
                  <rect
                    x={x(i) - barW / 2}
                    y={base - measured - filled}
                    width={barW}
                    height={filled}
                    rx={1.5}
                    fill={`url(#${hatchId})`}
                    opacity={hover === null || hover === i ? 0.75 : 0.3}
                  />
                )}
                {/* A full-height target, so the pointer does not have to find a 3px bar. */}
                <rect
                  x={x(i) - step / 2}
                  y={0}
                  width={Math.max(step, 6)}
                  height={H}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                />
              </g>
            );
          })}

          {active !== null && hover !== null && (
            <line
              x1={x(hover)}
              y1={padTop}
              x2={x(hover)}
              y2={padTop + plotH}
              stroke="#0c4f54"
              strokeWidth="1"
              strokeDasharray="3 3"
              opacity="0.4"
            />
          )}
        </g>

        {data.map((d, i) =>
          i % labelEvery === 0 || i === data.length - 1 ? (
            <text
              key={`l-${d.date}`}
              x={x(i)}
              y={H - 8}
              textAnchor="middle"
              className="fill-neutral-500"
              style={{ fontSize: 10 }}
            >
              {d.label}
            </text>
          ) : null,
        )}
      </svg>

      {active && (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg">
          <p className="font-semibold text-neutral-900">{active.label}</p>
          <p className="mt-0.5 text-neutral-600 tnum">
            {active.cumulative} finished in total
          </p>
          <p className="text-neutral-500 tnum">
            {active.completed} that day
            {active.backfilled > 0 && ` · ${active.backfilled} undated`}
          </p>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded bg-primary-700" aria-hidden="true" />
          Running total
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-info-500" aria-hidden="true" />
          Finished that day
        </span>
        {data.some((d) => d.backfilled > 0) && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-sm border border-neutral-400 bg-neutral-200"
              aria-hidden="true"
            />
            Recorded before we tracked dates
          </span>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Progress distribution                                             */
/* ================================================================== */

/**
 * How many learners sit in each progress band.
 *
 * "Not started" and "Complete" are tinted differently from the middle bands
 * because they are the two numbers anybody looks for first, and they are the
 * two that call for action.
 */
export function ProgressDistribution({
  data,
  total,
}: {
  data: ProgressBand[];
  total: number;
}) {
  const max = Math.max(1, ...data.map((b) => b.learners));

  function toneFor(label: string): string {
    if (label === "Not started") return "bg-neutral-300";
    if (label === "Complete") return "bg-success-500";
    return "bg-info-500";
  }

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        Nobody is on this yet.
      </p>
    );
  }

  return (
    <ul className="space-y-2.5">
      {data.map((band) => (
        <li key={band.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 text-xs text-neutral-500">{band.label}</span>
          <div className="ws-hatch h-5 flex-1 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full ${toneFor(band.label)}`}
              style={{ width: `${(band.learners / max) * 100}%` }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-xs text-neutral-600 tnum">
            {band.learners} · {band.share}%
          </span>
        </li>
      ))}
    </ul>
  );
}

/* ================================================================== */
/*  Lecture funnel                                                    */
/* ================================================================== */

/**
 * Completions per lecture, in curriculum order, with the drop-off.
 *
 * This is where a course is actually diagnosed. A cliff between lecture four
 * and five is a lecture-five problem, and no aggregate percentage will ever
 * say so — which is why the drop-off is measured against the lecture *before*
 * rather than against the cohort.
 *
 * Anything losing more than a fifth of the previous lecture is called out in
 * words as well as colour, so the signal does not depend on seeing red.
 */
export function LectureFunnel({ rows }: { rows: LectureFunnelRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-neutral-500">
        This course has no lectures yet.
      </p>
    );
  }

  const STEEP = 20;

  return (
    <ol className="space-y-2">
      {rows.map((row) => {
        const steep = row.dropOff >= STEEP;

        return (
          <li key={`${row.position}-${row.title}`} className="flex items-center gap-3">
            <span className="w-6 shrink-0 text-right text-[11px] text-neutral-500 tnum">
              {row.position}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate text-xs font-medium text-neutral-800">{row.title}</p>
                <span className="shrink-0 text-[11px] text-neutral-500 tnum">
                  {row.completed} · {row.share}%
                </span>
              </div>
              <div className="ws-hatch mt-1 h-2 overflow-hidden rounded-full bg-neutral-100">
                <div
                  className={`h-full rounded-full ${steep ? "bg-error-500" : "bg-primary-500"}`}
                  style={{ width: `${row.share}%` }}
                />
              </div>
            </div>
            <span
              className={`w-24 shrink-0 text-right text-[11px] tnum ${
                steep ? "font-semibold text-error-700" : "text-neutral-400"
              }`}
            >
              {row.dropOff > 0 ? `−${row.dropOff}%` : "—"}
              {steep && <span className="sr-only"> — steep drop-off</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
