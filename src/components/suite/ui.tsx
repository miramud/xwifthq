import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  type LucideIcon,
} from "lucide-react";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { HUE, PRODUCTS, type Product, type ProductHue } from "@/lib/products";
import type {
  BarDatum,
  KpiItem,
  SuiteActivityEntry,
} from "@/lib/suite-data";

/**
 * The primitives the four module dashboards share.
 *
 * Almost everything a dashboard needs already exists in
 * `@/components/dashboard/ui`, the LMS console has been using it for months.
 * Re-exporting it rather than restating it is the point of this file: one
 * `Pill`, one `SectionCard`, one set of paddings across the whole app. Only
 * the five things below are genuinely new, and all five exist because a
 * module dashboard needs them and the LMS console never did.
 *
 * This file is a Server Component on purpose. Nothing here holds state, so
 * nothing here should cost a hydration boundary; a dashboard that needs
 * interactivity wraps the interactive part itself.
 */

/* Kit's `cx` lives in a "use client" file and can't be called from here. */
const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

/* ---------- re-exports ------------------------------------------- */

export {
  ActionMenu,
  Avatar,
  BackLink,
  EmptyState,
  FilterPills,
  PageHeading,
  Pill,
  ProgressBar,
  SearchBox,
  SectionCard,
  StatTile,
  Tabs,
} from "@/components/dashboard/ui";
export type { ActionItem, Tone } from "@/components/dashboard/ui";

/* ---------- module page heading ---------------------------------- */

/**
 * The heading of a page inside a module.
 *
 * The rule above the eyebrow is one of the four places a product's hue is
 * allowed to appear: an icon tile, an eyebrow rule, a chart accent, and the
 * active nav state inside its own shell. It is a label for *which* module you
 * are in, never a theme, the actions on the right stay teal like every other
 * primary action in the product.
 *
 * This owns the page's single `<h1>`. The shell's top bar deliberately does
 * not render one, so heading order stays sequential.
 */
export function ModuleHeader({
  product,
  title,
  subtitle,
  children,
}: {
  product: Product;
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  const hue = HUE[product.hue];

  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <span
            className={cx("block h-1.5 w-8 rounded-full", hue.rule)}
            aria-hidden="true"
          />
          <span className={cx("text-xs font-semibold uppercase tracking-wide", hue.text)}>{product.name}</span>
        </p>
        <h1 className="mt-2 font-heading text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-neutral-500">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </header>
  );
}

/* ---------- KPI row ---------------------------------------------- */

/**
 * Direction, not judgement.
 *
 * Every trend gets a glyph and a word as well as the signed delta, because
 * colour alone carries nothing to a screen reader or to anyone who cannot
 * separate the two hues. Nothing here is coloured green or red either: a
 * headcount falling is not automatically worse than a headcount rising, and a
 * component has no business deciding which.
 */
const TREND: Record<"up" | "down" | "flat", { icon: LucideIcon; word: string }> = {
  up: { icon: ArrowUpRight, word: "up" },
  down: { icon: ArrowDownRight, word: "down" },
  flat: { icon: Minus, word: "unchanged" },
};

export function KpiRow({
  items,
  hue,
}: {
  items: readonly KpiItem[];
  hue: ProductHue;
}) {
  const tokens = HUE[hue];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        const trend = item.trend ? TREND[item.trend] : null;
        const TrendIcon = trend?.icon;

        return (
          <div
            key={item.label}
            className="ws-card flex items-center gap-4 p-5"
          >
            <span
              className={cx("inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full", tokens.tile)}
            >
              <Icon className={cx("h-5 w-5", tokens.icon)} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-neutral-500">{item.label}</p>
              <p className="mt-0.5 font-heading text-2xl font-bold leading-tight tracking-tight text-neutral-900 tnum">
                {item.value}
              </p>
              {(item.delta || trend) && (
                <span className="mt-1 inline-flex items-center gap-0.5 rounded-full bg-neutral-100 px-1.5 py-0.5 text-xs font-semibold text-neutral-700">
                  {TrendIcon && <TrendIcon className="h-3 w-3" aria-hidden="true" />}
                  {item.delta && <span className="tnum">{item.delta}</span>}
                  {trend && <span className="sr-only">{trend.word}</span>}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- data table ------------------------------------------- */

export interface DataTableColumn<T> {
  key: string;
  header: string;
  /** Numbers right-align and get tabular figures. */
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
}

/**
 * A real table.
 *
 * The wrapper is focusable with an accessible name because a table that
 * scrolls sideways is unreachable by keyboard otherwise, the pointer can drag
 * it and nothing else can. `caption` is visually hidden rather than absent:
 * the heading above the card says the same thing to sighted readers, and a
 * table with no caption announces itself as "table" and nothing more.
 *
 * The tab stop is unconditional, which costs a keystroke on a table that
 * happens to fit. Whether it fits is a fact about the rendered width, and the
 * only way to know it is to measure in the browser, which would make this a
 * client component with a ResizeObserver for every table in the suite. A
 * spurious stop on a named region is a smaller cost than that; a missing stop
 * on a scrolled one is a larger one.
 */
export function DataTable<T>({
  columns,
  rows,
  caption,
  empty = "Nothing to show.",
}: {
  columns: readonly DataTableColumn<T>[];
  rows: readonly T[];
  caption: string;
  empty?: string;
}) {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label={caption}
      className="overflow-x-auto rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-inset"
    >
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="bg-neutral-50">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cx(
                  "whitespace-nowrap px-4 py-3 text-xs font-semibold text-neutral-500 first:rounded-l-xl last:rounded-r-xl",
                  column.align === "right" ? "text-right" : "text-left",
                )}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-sm text-neutral-500"
              >
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={index}
                className="border-b border-neutral-100 transition-colors last:border-0 hover:bg-primary-50/40"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      "px-4 py-3.5 align-middle text-neutral-700",
                      column.align === "right" ? "text-right tnum" : "text-left",
                    )}
                  >
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- mini bar chart --------------------------------------- */

/**
 * Chart fills need their own values, and this is why.
 *
 * `HUE[*].hex` is calibrated for the two jobs the registry actually gives it:
 * a glyph on a 10%-tinted tile, and eyebrow text. A bar sitting on a white
 * card is neither, it is a graphical object, judged at 3:1 under WCAG 1.4.11
 * against the card it sits on. Summit Gold at `accent-500` is 2.14:1 on white,
 * so a Finance chart using the registry hex fails at every bar however tall.
 *
 * So each hue steps to the value that clears the bar, which is the same
 * reasoning `CashFlowChart` already applies to its gold hairline. Measured
 * against #ffffff: accent-600 3.43:1, violet-600 8.59:1, info-600 5.93:1,
 * neutral-700 9.90:1, primary-600 9.28:1.
 */
const CHART_FILL: Record<ProductHue, string> = {
  primary: "fill-primary-600",
  violet: "fill-violet-600",
  accent: "fill-accent-600",
  neutral: "fill-neutral-700",
  info: "fill-info-600",
};

/**
 * A small inline SVG chart, never a raster, never a charting dependency.
 *
 * The bars are the module's hue, which is the third of the four places a hue
 * is allowed: a chart accent inside that module's own surfaces. The summary
 * on the `role="img"` tells a screen reader what the shape is; the hidden list
 * gives it the actual numbers, because "a chart of monthly cash" is not a
 * substitute for the values a sighted reader can read off the bars.
 *
 * **Every bar is the same solid fill.** An opacity ramp keyed to the value was
 * double-encoding, the bar's height already says how big it is, and the only
 * thing it changed was the contrast, dragging the shortest bar of every module
 * to somewhere between 1.2:1 and 1.5:1. A mark you cannot see is not a subtler
 * mark.
 *
 * **No `viewBox`.** Stretching one with `preserveAspectRatio="none"` scaled x
 * and y by different factors, which turns a uniform `rx` into an ellipse that
 * gets flatter as the card gets wider. Sizing the SVG in CSS and placing the
 * bars in percentages means the geometry is never scaled, so a 2px radius is
 * 2px at every viewport.
 */
export function MiniBars({
  data,
  hue,
  label,
  unit,
}: {
  data: readonly BarDatum[];
  hue: ProductHue;
  label: string;
  /**
   * What the numbers count, e.g. "naira millions". A screen reader gets the
   * values as bare digits, where a sighted reader has the card's heading and
   * the axis around them to supply the unit.
   */
  unit?: string;
}) {
  const max = data.reduce((m, d) => Math.max(m, d.value), 0) || 1;
  const height = 56;
  const fill = CHART_FILL[hue];

  /* Percentage bands rather than a pixel grid, see the note on viewBox. */
  const band = 100 / data.length;
  const barWidth = band * 0.72;

  const values = data.map((d) => d.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const suffix = unit ? ` ${unit}` : "";

  return (
    <figure className="m-0">
      <svg
        className="h-14 w-full overflow-visible"
        role="img"
        aria-label={`${label}. ${data.length} values${
          unit ? ` in ${unit}` : ""
        }, lowest ${low}, highest ${high}.`}
      >
        {data.map((d, i) => {
          const barHeight = Math.max(2, (d.value / max) * (height - 2));
          return (
            <rect
              key={d.label}
              x={`${i * band}%`}
              y={height - barHeight}
              width={`${barWidth}%`}
              height={barHeight}
              rx={3}
              className={cx("animate-grow-up", fill)}
              style={{ animationDelay: `${i * 45}ms` }}
            />
          );
        })}
      </svg>

      <ul className="sr-only">
        {data.map((d) => (
          <li key={d.label}>
            {d.label}: {d.value}
            {suffix}
          </li>
        ))}
      </ul>

      <figcaption className="mt-2 flex justify-between text-[11px] text-neutral-500">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </figcaption>
    </figure>
  );
}

/* ---------- cross-module timeline -------------------------------- */

/**
 * The activity feed, and the one place all five modules appear at once.
 *
 * An ordered list because the order is the meaning: an offer is accepted, then
 * assets are issued, then a pathway is assigned. Each entry carries the icon
 * tile of the module that acted, which is what makes "one audit log" visible
 * rather than merely asserted.
 *
 * Times are fixed labels from the fixtures. Nothing here recomputes against
 * the clock, because nothing here is actually happening.
 */
export function Timeline({ items }: { items: readonly SuiteActivityEntry[] }) {
  return (
    <ol className="relative space-y-0">
      {items.map((item, index) => {
        const product = PRODUCTS[item.module];
        const last = index === items.length - 1;

        return (
          <li key={`${item.time}-${item.title}`} className="relative flex gap-4 pb-5 last:pb-0">
            {/* The thread between entries, decorative; the list carries order. */}
            {!last && (
              <span
                className="absolute left-[17px] top-10 bottom-0 w-px bg-neutral-200"
                aria-hidden="true"
              />
            )}
            <ProductIcon product={product} size="sm" className="relative z-10" />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-sm font-semibold text-neutral-900">
                  {item.title}
                </span>
                <span className="text-xs font-medium tabular-nums text-neutral-500">{item.time}</span>
              </p>
              <p className="mt-0.5 text-xs text-neutral-500">
                {product.name}
                {item.detail ? ` · ${item.detail}` : ""}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
