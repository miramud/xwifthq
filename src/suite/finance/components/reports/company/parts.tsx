"use client";

import { Fragment, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { accounting } from "@/suite/finance/lib/format";
import type { CrSection } from "@/lib/api/finance-company-report-client";

/*
  The pieces every chapter of the company report is built from: the chapter
  itself, a table with a totals row that prints in full, a quiet "nothing
  here" line, and two hand-drawn bars the chart kit doesn't have (budget
  against spend, and one stacked bar for aging).
*/

export const num = "text-right tabular-nums whitespace-nowrap";
export const money = (v: number | null | undefined) => accounting(v ?? null, true);

/* ------------------------------ chapter ----------------------------- */

export function Chapter({
  id,
  index,
  title,
  lede,
  icon: Icon,
  hue = "blue",
  children,
}: {
  id: string;
  index: number;
  title: string;
  lede?: React.ReactNode;
  icon: LucideIcon;
  hue?: Hue;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="cr-chapter scroll-mt-20 lg:scroll-mt-6">
      <header className="mb-4 flex items-start gap-3 border-b border-neutral-200 pb-3">
        <span className={cx("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl print:hidden", HUE[hue].soft)}>
          <Icon size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-600 tabular-nums">Section {String(index).padStart(2, "0")}</p>
          <h2 id={`${id}-h`} className="text-xl font-bold tracking-tight text-neutral-900">
            {title}
          </h2>
          {lede && <p className="mt-0.5 max-w-3xl text-sm text-neutral-500">{lede}</p>}
        </div>
      </header>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** A titled block inside a chapter. */
export function Block({ title, sub, actions, children, className, flush }: { title?: React.ReactNode; sub?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; flush?: boolean }) {
  return (
    <div className={cx("ws-card cr-block overflow-hidden", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h3 className="text-base font-bold tracking-tight text-neutral-900">{title}</h3>}
            {sub && <p className="mt-0.5 text-xs text-neutral-500">{sub}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2 print:hidden">{actions}</div>}
        </div>
      )}
      <div className={flush ? "pt-3" : "p-5 pt-3"}>{children}</div>
    </div>
  );
}

export function Nothing({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">{children}</p>;
}

/* ------------------------------- table ------------------------------ */

export interface Col<T> {
  label: string;
  num?: boolean;
  cell: (r: T) => React.ReactNode;
  /** What the totals row shows under this column. */
  total?: React.ReactNode;
  className?: string;
}

/**
 * A register table: scrolls sideways inside its card on a phone, sticks to
 * `limit` rows on screen with a "Show all" (the printout always has every
 * row), and closes with a totals row when any column has one.
 */
export function Table<T>({
  caption,
  cols,
  rows,
  rowKey,
  limit = 12,
  empty = "Nothing for this period.",
  rowClass,
  expand,
}: {
  caption: string;
  cols: Col<T>[];
  rows: T[];
  rowKey: (r: T, i: number) => string;
  limit?: number;
  empty?: string;
  rowClass?: (r: T) => string | undefined;
  /** A detail row under a row, shown when the row is opened. */
  expand?: { open: (r: T) => boolean; render: (r: T) => React.ReactNode };
}) {
  const [all, setAll] = useState(false);
  if (rows.length === 0) return <Nothing>{empty}</Nothing>;
  const hasTotals = cols.some((c) => c.total !== undefined);
  const cut = !all && rows.length > limit;
  return (
    <div>
      <div className="-mx-5 overflow-x-auto px-5">
        <table className="w-full min-w-[36rem] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="bg-primary-50/60 text-left text-xs font-semibold text-neutral-600 print:bg-transparent">
              {cols.map((c) => (
                <th key={c.label} scope="col" className={cx("py-2.5 pr-4 font-semibold first:rounded-l-xl first:pl-3 last:rounded-r-xl last:pr-3", c.num && "text-right", c.className)}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const hidden = cut && i >= limit;
              const open = expand?.open(r);
              return (
                <Fragment key={rowKey(r, i)}>
                  <tr className={cx("border-b border-neutral-100 align-top", hidden && "hidden print:table-row", rowClass?.(r))}>
                    {cols.map((c) => (
                      <td key={c.label} className={cx("py-3 pr-4 first:pl-3 last:pr-3", c.num ? num : "text-neutral-700", c.className)}>
                        {c.cell(r)}
                      </td>
                    ))}
                  </tr>
                  {expand && open && (
                    <tr className={cx("border-b border-neutral-100 bg-neutral-50/70", hidden && "hidden print:table-row")}>
                      <td colSpan={cols.length} className="px-3 py-3">
                        {expand.render(r)}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {hasTotals && (
            <tfoot>
              <tr className="border-t-2 border-neutral-300 font-semibold text-neutral-900">
                {cols.map((c, i) => (
                  <td key={c.label} className={cx("py-3 pr-4 first:pl-3 last:pr-3", c.num && num, c.className)}>
                    {c.total ?? (i === 0 ? "Total" : "")}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {rows.length > limit && (
        <button
          type="button"
          onClick={() => setAll((a) => !a)}
          aria-expanded={all}
          className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-lg text-sm font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300 print:hidden"
        >
          <ChevronDown size={15} className={cx("transition-transform", all && "rotate-180")} aria-hidden />
          {all ? "Show fewer" : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  );
}

/* --------------------------- statement lines ------------------------ */

/** A statement section as printed: heading, account lines, total over a rule. */
export function StatementLines({ title, section, totalLabel }: { title: string; section: CrSection; totalLabel: string }) {
  return (
    <>
      <tr>
        <th colSpan={2} scope="colgroup" className="pb-1 pt-5 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </th>
      </tr>
      {section.rows.length === 0 ? (
        <tr>
          <td colSpan={2} className="py-2 pl-4 text-neutral-500">
            Nothing posted
          </td>
        </tr>
      ) : (
        section.rows.map((r) => (
          <tr key={`${r.code}-${r.name}`}>
            <th scope="row" className="py-1.5 pl-4 pr-4 text-left font-normal text-neutral-700">
              <span className="mr-2 font-mono text-[12px] text-neutral-500">{r.code}</span>
              {r.name}
            </th>
            <td className={cx(num, "py-1.5")}>{money(r.amount)}</td>
          </tr>
        ))
      )}
      <Line label={totalLabel} value={section.total} strong rule="top" />
    </>
  );
}

export function Line({ label, value, strong, rule, muted }: { label: React.ReactNode; value: number | null; strong?: boolean; rule?: "top" | "double"; muted?: boolean }) {
  return (
    <tr className={cx(strong && "font-semibold text-neutral-900", muted && "text-neutral-500")}>
      <th scope="row" className="py-2 pr-4 text-left font-[inherit]">
        {label}
      </th>
      <td className={cx(num, "py-2", rule === "top" && "border-t border-neutral-300", rule === "double" && "border-b-[3px] border-t border-double border-neutral-400")}>
        {value === null ? "" : money(value)}
      </td>
    </tr>
  );
}

export function Statement({ caption, currency, children }: { caption: string; currency: string; children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead className="sr-only">
        <tr>
          <th scope="col">Line</th>
          <th scope="col">Amount ({currency})</th>
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

/* --------------------------- budget vs spend ------------------------ */

/** A bar's gradient per hue, matching the kit's progress bars. */
const BAR_FILL: Record<Hue, string> = {
  blue: "from-primary-500 to-primary-400",
  coral: "from-coral-500 to-coral-400",
  mint: "from-mint-500 to-mint-400",
  grape: "from-grape-500 to-grape-400",
  sun: "from-sun-500 to-sun-300",
  sky: "from-sky-500 to-sky-400",
  rose: "from-rose-500 to-rose-400",
  slate: "from-neutral-600 to-neutral-400",
};

/**
 * One row per item: the budget as a hatched track, what was spent as a
 * solid bar over it, and a tick where the budget ends when spend runs past.
 * The words on the right say both figures - never the bar alone.
 */
export function BudgetBars({
  rows,
  format,
  caption,
}: {
  rows: { label: string; budget: number; spent: number; hue: Hue; note?: string }[];
  format: (v: number) => string;
  caption: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.budget, r.spent]));
  return (
    <figure className="space-y-3.5">
      {rows.map((r) => {
        const over = r.budget > 0 && r.spent > r.budget;
        return (
          <div key={r.label}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
              <span className="min-w-0 truncate font-medium text-neutral-700">{r.label}</span>
              <span className="text-xs text-neutral-500 tabular-nums">
                {r.note && <span className="mr-2">{r.note}</span>}
                <span className="font-semibold text-neutral-900">{format(r.spent)}</span> of {r.budget > 0 ? format(r.budget) : "no budget"}
                {over && <span className="ml-1.5 font-semibold text-rose-700">over</span>}
              </span>
            </div>
            <div className="relative h-3 rounded-full bg-primary-50">
              <div className="ws-hatch absolute inset-y-0 left-0 rounded-full" style={{ width: `${(r.budget / max) * 100}%` }} />
              <div className={cx("absolute inset-y-0 left-0 rounded-full bg-gradient-to-r", HUE[r.hue].bar, BAR_FILL[r.hue])} style={{ width: `${Math.max(r.spent > 0 ? 1.5 : 0, (r.spent / max) * 100)}%` }} />
              {over && <span className="absolute -inset-y-1 w-0.5 rounded bg-neutral-900" style={{ left: `${(r.budget / max) * 100}%` }} aria-hidden />}
            </div>
          </div>
        );
      })}
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Item</th>
            <th scope="col">Budget</th>
            <th scope="col">Spent</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td>{format(r.budget)}</td>
              <td>{format(r.spent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/* ---------------------------- stacked bar --------------------------- */

/** One bar split into its parts (aging buckets), with a legend naming each part and its amount. */
export function StackBar({ parts, format, caption }: { parts: { label: string; value: number; hue: Hue }[]; format: (v: number) => string; caption: string }) {
  const sum = parts.reduce((s, p) => s + Math.max(0, p.value), 0);
  return (
    <figure>
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-primary-50" role="img" aria-label={caption}>
        {sum > 0 ? (
          parts
            .filter((p) => p.value > 0)
            .map((p) => <div key={p.label} className={cx("h-full border-r-2 border-white last:border-r-0", HUE[p.hue].bar)} style={{ width: `${(p.value / sum) * 100}%` }} />)
        ) : (
          <div className="ws-hatch h-full w-full" />
        )}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3 lg:grid-cols-6">
        {parts.map((p) => (
          <li key={p.label} className="min-w-0">
            <span className="flex items-center gap-1.5 text-xs text-neutral-500">
              <span className={cx("h-2.5 w-2.5 shrink-0 rounded-full", HUE[p.hue].dot)} aria-hidden />
              {p.label}
            </span>
            <span className="block font-semibold text-neutral-900 tabular-nums">
              {format(p.value)}
              {sum > 0 && <span className="ml-1 text-xs font-medium text-neutral-500">{Math.round((p.value / sum) * 100)}%</span>}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/* ------------------------------ figures ----------------------------- */

/** A small labelled figure, for the strips under a chapter heading. */
export function Figure({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="min-w-0 rounded-2xl bg-primary-50/50 px-4 py-3 ring-1 ring-inset ring-primary-100/70">
      <p className="truncate text-xs font-medium text-neutral-500">{label}</p>
      <p className={cx("mt-1 truncate text-lg font-bold tracking-tight tabular-nums", tone === "bad" ? "text-rose-700" : tone === "good" ? "text-mint-700" : "text-neutral-900")}>{value}</p>
      {hint && <p className="mt-0.5 truncate text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

export function Figures({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{children}</div>;
}
