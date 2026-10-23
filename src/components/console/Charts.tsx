"use client";

/* ------------------------------------------------------------------ */
/*  Lightweight, dependency-free SVG charts for the admin dashboard.   */
/*  Responsive (viewBox scaling), with hover tooltips.                 */
/*                                                                      */
/*  Worn in the workspace palette (DESIGN.md): rounded bars growing     */
/*  out of a hatched track, rounded donut segments with gaps, soft      */
/*  gridlines. New pages should reach for workspace/charts.tsx; these   */
/*  keep their old API so existing callers look right unchanged.        */
/* ------------------------------------------------------------------ */

import { useId, useState } from "react";

/**
 * The old console palette (teal brand, tailwind defaults) mapped onto the
 * workspace hues, so a caller still passing a legacy hex is drawn in the
 * workspace's colours rather than the marketing site's.
 */
const LEGACY: Record<string, string> = {
  "#0c4f54": "#2563eb",
  "#14b8a6": "#10b981",
  "#22c55e": "#10b981",
  "#e6a532": "#f59e0b",
  "#eab308": "#f59e0b",
  "#ef4444": "#f2674a",
  "#6366f1": "#8b5cf6",
};
const WS_BLUE = "#2563eb";
function tone(color: string | undefined): string {
  if (!color) return WS_BLUE;
  return LEGACY[color.toLowerCase()] ?? color;
}

/** The workspace hatch, as an SVG pattern (CSS backgrounds do not reach SVG). */
function HatchDef({ id }: { id: string }) {
  return (
    <pattern id={id} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="7" height="7" fill="#f1f5f9" />
      <line x1="0" y1="0" x2="0" y2="7" stroke="#cbd5e1" strokeOpacity="0.7" strokeWidth="2" />
    </pattern>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared helpers                                                     */
/* ------------------------------------------------------------------ */

/** Smooth a polyline with horizontal-tangent cubic beziers. */
function smoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length === 0) return "";
  if (pts.length === 1) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i];
    const p1 = pts[i + 1];
    const mx = (p0.x + p1.x) / 2;
    d += ` C ${mx},${p0.y} ${mx},${p1.y} ${p1.x},${p1.y}`;
  }
  return d;
}

/* ================================================================== */
/*  Area / line chart                                                  */
/* ================================================================== */

export interface AreaPoint {
  label: string;
  value: number;
}

export function AreaChart({
  data,
  color = "#2563eb",
  formatValue = (n) => n.toLocaleString(),
  formatTooltip,
  height = 260,
  ariaLabel,
}: {
  data: AreaPoint[];
  color?: string;
  formatValue?: (n: number) => string;
  formatTooltip?: (p: AreaPoint) => string;
  height?: number;
  ariaLabel?: string;
}) {
  color = tone(color);
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);

  const W = 760;
  const H = height;
  const padT = 16;
  const padB = 34;
  const padL = 8;
  const padR = 8;

  const n = data.length;

  // Empty data would dereference pts[-1] below — render a placeholder instead.
  if (n === 0) {
    return (
      <div
        className="flex w-full items-center justify-center text-sm text-neutral-500"
        style={{ height: H }}
        role="img"
        aria-label={ariaLabel}
      >
        No data to display
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.value), 1);
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const xAt = (i: number) =>
    padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - (v / max) * plotH;

  const pts = data.map((d, i) => ({ x: xAt(i), y: yAt(d.value) }));
  const linePath = smoothPath(pts);
  const areaPath =
    linePath +
    ` L ${pts[pts.length - 1].x},${padT + plotH}` +
    ` L ${pts[0].x},${padT + plotH} Z`;

  // 4 horizontal gridlines
  const grid = [0.25, 0.5, 0.75, 1].map((f) => padT + plotH - f * plotH);

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - rect.left) / rect.width; // 0..1 across full svg
    const xPx = t * W;
    // nearest index by x
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < n; i++) {
      const dist = Math.abs(xAt(i) - xPx);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    setHover(best);
  }

  const hoverPt = hover != null ? pts[hover] : null;
  const tooltipLeftPct = hover != null ? (xAt(hover) / W) * 100 : 0;
  const tooltipTopPct = hoverPt ? (hoverPt.y / H) * 100 : 0;

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={ariaLabel}
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`area-${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* gridlines */}
        {grid.map((y, i) => (
          <line
            key={i}
            x1={padL}
            x2={W - padR}
            y1={y}
            y2={y}
            stroke="#eef2f7"
            strokeWidth={1}
          />
        ))}

        {/* area fill */}
        <path d={areaPath} fill={`url(#area-${uid})`} />

        {/* line */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          vectorEffect="non-scaling-stroke"
          className="animate-draw-line"
        />

        {/* x-axis labels */}
        {data.map((d, i) => (
          <text
            key={d.label + i}
            x={xAt(i)}
            y={H - 12}
            textAnchor="middle"
            className="fill-neutral-500"
            style={{ fontSize: 11 }}
          >
            {d.label}
          </text>
        ))}

        {/* hover guide + marker */}
        {hoverPt && (
          <g>
            <line
              x1={hoverPt.x}
              x2={hoverPt.x}
              y1={padT}
              y2={padT + plotH}
              stroke={color}
              strokeWidth={1}
              strokeOpacity={0.4}
            />
            <circle
              cx={hoverPt.x}
              cy={hoverPt.y}
              r={5.5}
              fill="#fff"
              stroke={color}
              strokeWidth={2.5}
            />
          </g>
        )}
      </svg>

      {/* tooltip */}
      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${tooltipLeftPct}%`,
            top: `calc(${tooltipTopPct}% - 12px)`,
          }}
        >
          <p className="font-semibold text-neutral-900 tnum">
            {formatValue(data[hover].value)}
          </p>
          <p className="text-neutral-500">
            {formatTooltip
              ? formatTooltip(data[hover])
              : data[hover].label}
          </p>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Vertical bar chart                                                 */
/* ================================================================== */

export interface BarDatum {
  label: string;
  value: number;
  color?: string;
}

export function BarChart({
  data,
  color = "#2563eb",
  formatValue = (n) => n.toLocaleString(),
  height = 260,
  ariaLabel,
}: {
  data: BarDatum[];
  color?: string;
  formatValue?: (n: number) => string;
  height?: number;
  ariaLabel?: string;
}) {
  color = tone(color);
  const hatchId = `hatch-${useId().replace(/:/g, "")}`;
  const [hover, setHover] = useState<number | null>(null);

  const W = 760;
  const H = height;
  const padT = 16;
  const padB = 34;
  const padX = 8;

  const n = data.length;
  const max = Math.max(...data.map((d) => d.value), 1);
  const plotW = W - padX * 2;
  const plotH = H - padT - padB;

  const slot = plotW / Math.max(n, 1);
  const barW = Math.min(44, slot * 0.62);

  const grid = [0.25, 0.5, 0.75, 1].map((f) => padT + plotH - f * plotH);

  return (
    <div className="relative w-full">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={ariaLabel}
        onMouseLeave={() => setHover(null)}
        className="overflow-visible"
      >
        <defs>
          <HatchDef id={hatchId} />
        </defs>
        {grid.map((y, i) => (
          <line
            key={i}
            x1={padX}
            x2={W - padX}
            y1={y}
            y2={y}
            stroke="#eef2f7"
            strokeWidth={1}
          />
        ))}

        {data.map((d, i) => {
          const cx = padX + slot * i + slot / 2;
          const h = (d.value / max) * plotH;
          const y = padT + plotH - h;
          const fill = tone(d.color ?? color);
          const active = hover === i;
          return (
            <g
              key={d.label + i}
              onMouseEnter={() => setHover(i)}
              style={{ cursor: "pointer" }}
            >
              {/* invisible hit area covering full column height */}
              <rect
                x={cx - slot / 2}
                y={padT}
                width={slot}
                height={plotH}
                fill="transparent"
              />
              {/* the hatched track: what the column could still grow into */}
              <rect
                x={cx - barW / 2}
                y={padT}
                width={barW}
                height={plotH}
                rx={Math.min(12, barW / 2)}
                fill={`url(#${hatchId})`}
              />
              <rect
                x={cx - barW / 2}
                y={y}
                width={barW}
                height={Math.max(h, 0.5)}
                rx={Math.min(12, barW / 2, Math.max(h, 0.5) / 2)}
                fill={fill}
                opacity={hover == null || active ? 1 : 0.45}
                className="animate-grow-up"
                style={{ animationDelay: `${i * 45}ms` }}
              />
              <text
                x={cx}
                y={H - 12}
                textAnchor="middle"
                className={active ? "fill-neutral-700" : "fill-neutral-500"}
                style={{ fontSize: 11, fontWeight: active ? 600 : 400 }}
              >
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>

      {hover != null && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${((padX + slot * hover + slot / 2) / W) * 100}%`,
            top: `${(((padT + plotH - (data[hover].value / max) * plotH) / H) * 100) - 2}%`,
          }}
        >
          <p className="font-semibold text-neutral-900 tnum">
            {formatValue(data[hover].value)}
          </p>
          <p className="text-neutral-500">{data[hover].label}</p>
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  Donut chart                                                        */
/* ================================================================== */

export interface DonutDatum {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  data,
  size = 200,
  thickness = 22,
  centerLabel,
  centerValue,
  formatValue = (n) => n.toLocaleString(),
}: {
  data: DonutDatum[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  formatValue?: (n: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  data = data.map((d) => ({ ...d, color: tone(d.color) }));
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  // Rounded segments with a small gap between them, as the workspace donut
  // draws them. A round cap adds half the stroke to each end, so the dash is
  // shortened by the thickness plus the gap.
  const many = data.filter((d) => d.value > 0).length > 1;
  const trim = many ? thickness + 4 : 0;
  let offsetAcc = 0;
  const segments = data.map((d) => {
    const frac = d.value / total;
    const len = frac > 0 ? Math.max(0.5, frac * c - trim) : 0;
    const seg = {
      ...d,
      frac,
      dash: len,
      gap: c - len,
      offset: -offsetAcc * c - trim / 2,
    };
    offsetAcc += frac;
    return seg;
  });

  const center =
    hover != null
      ? {
          label: data[hover].label,
          value: `${Math.round((data[hover].value / total) * 100)}%`,
        }
      : { label: centerLabel ?? "Total", value: centerValue ?? formatValue(total) };

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          role="img"
          aria-label="Distribution donut chart"
        >
          <g transform={`rotate(-90 ${cx} ${cy})`}>
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="#f1f5f9"
              strokeWidth={thickness}
            />
            {segments.map((s, i) => {
              const active = hover === i;
              return (
                <circle
                  key={s.label}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={active ? thickness + 5 : thickness}
                  strokeDasharray={`${s.dash} ${s.gap}`}
                  strokeDashoffset={s.offset}
                  strokeLinecap={many && s.frac > 0 ? "round" : "butt"}
                  opacity={hover == null || active ? 1 : 0.4}
                  style={{
                    cursor: "pointer",
                    transition: "opacity .2s, stroke-width .2s",
                  }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              );
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
            {center.value}
          </span>
          <span className="max-w-[80%] truncate text-[11px] font-medium text-neutral-500">
            {center.label}
          </span>
        </div>
      </div>

      {/* legend */}
      <ul className="flex w-full flex-col gap-2">
        {data.map((d, i) => (
          <li
            key={d.label}
            className="flex cursor-pointer items-center gap-2.5 rounded-md px-1.5 py-1 transition-colors hover:bg-neutral-50"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: d.color }}
            />
            <span className="flex-1 truncate text-sm text-neutral-600">
              {d.label}
            </span>
            <span className="text-sm font-semibold text-neutral-900 tabular-nums">
              {Math.round((d.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================================================================== */
/*  Sparkline (tiny, decorative, non-interactive)                      */
/* ================================================================== */

export function Sparkline({
  values,
  color = "#2563eb",
  className = "",
}: {
  values: number[];
  color?: string;
  className?: string;
}) {
  color = tone(color);
  const uid = useId().replace(/:/g, "");
  const W = 120;
  const H = 36;
  const pad = 3;
  const n = values.length;

  // Nothing to draw — avoid dereferencing pts[-1] on empty input.
  if (n === 0) {
    return <svg viewBox={`0 0 ${W} ${H}`} className={className} aria-hidden="true" />;
  }

  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;

  const pts = values.map((v, i) => ({
    x: pad + (i / (n - 1)) * (W - pad * 2),
    y: pad + (1 - (v - min) / range) * (H - pad * 2),
  }));
  const line = smoothPath(pts);
  const area =
    line + ` L ${pts[n - 1].x},${H} L ${pts[0].x},${H} Z`;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#spark-${uid})`} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
