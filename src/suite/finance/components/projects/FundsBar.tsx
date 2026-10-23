"use client";

import { cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { compact } from "@/suite/finance/lib/format";

/*
  The funds pipe: one bar that reads left to right the way money moves on a
  project. The whole track is the budget (BAC). The part released by the MD
  is drawn solid - spent, then committed, then what is still available -
  and the budget not yet released is hatched, the workspace's "not yet".
  A tick marks where the release ends. Spend and commitments beyond the
  release (overdrawn) run past the tick in rose.

  The bar is a picture; its accessible name says every figure, and the
  legend beside it carries the words.
*/

export const FUNDS_SERIES: { key: "spent" | "committed" | "available" | "unreleased" | "over"; label: string; hue: Hue | null }[] = [
  { key: "spent", label: "Spent", hue: "blue" },
  { key: "committed", label: "Committed", hue: "grape" },
  { key: "available", label: "Available", hue: "mint" },
  { key: "unreleased", label: "Budget not released", hue: null },
  { key: "over", label: "Beyond the release", hue: "rose" },
];

export interface FundsFigures {
  bac: number;
  released: number;
  committed: number;
  spent: number;
  available: number;
}

/** The segments as shares of the track, in order. Pure, for testing. */
export function fundsSegments(f: FundsFigures) {
  const used = Math.max(0, f.spent) + Math.max(0, f.committed);
  const released = Math.max(0, f.released);
  const scale = Math.max(f.bac, released, used, 1);
  const within = Math.min(used, released);
  // Spent first, then committed, both inside the release where they fit.
  const spentIn = Math.min(Math.max(0, f.spent), released);
  const committedIn = Math.max(0, within - spentIn);
  const over = Math.max(0, used - released);
  const available = Math.max(0, released - used);
  const unreleased = Math.max(0, scale - released - over);
  const share = (v: number) => (v / scale) * 100;
  return {
    spent: share(spentIn),
    committed: share(committedIn),
    available: share(available),
    over: share(over),
    unreleased: share(unreleased),
    releasedAt: share(released),
  };
}

export function fundsLabel(f: FundsFigures, currency = "NGN"): string {
  const c = (v: number) => compact(v, currency as "NGN");
  return `Budget ${c(f.bac)}; released ${c(f.released)}; spent ${c(f.spent)}; committed ${c(f.committed)}; available ${c(f.available)}${f.available < 0 ? " (overdrawn)" : ""}.`;
}

export function FundsBar({ figures: f, size = "md", className }: { figures: FundsFigures; size?: "sm" | "md" | "lg"; className?: string }) {
  const s = fundsSegments(f);
  const h = size === "lg" ? "h-5" : size === "sm" ? "h-2" : "h-3";
  return (
    <div role="img" aria-label={fundsLabel(f)} className={cx("relative w-full", className)}>
      <div className={cx("ws-hatch flex w-full overflow-hidden rounded-full", h)}>
        <span className={cx("h-full", HUE.blue.bar)} style={{ width: `${s.spent}%` }} />
        <span className={cx("h-full", HUE.grape.bar)} style={{ width: `${s.committed}%` }} />
        <span className={cx("h-full", HUE.mint.bar, "opacity-90")} style={{ width: `${s.available}%` }} />
        <span className={cx("h-full", HUE.rose.bar)} style={{ width: `${s.over}%` }} />
      </div>
      {f.released > 0 && s.releasedAt < 99.5 && (
        <span
          aria-hidden
          className={cx("absolute top-1/2 w-0.5 -translate-y-1/2 rounded-full bg-neutral-900/70", size === "lg" ? "h-8" : size === "sm" ? "h-3.5" : "h-5")}
          style={{ left: `calc(${s.releasedAt}% - 1px)` }}
        />
      )}
    </div>
  );
}

export function FundsLegend({ figures, currency = "NGN", show = ["spent", "committed", "available", "unreleased"] }: { figures?: FundsFigures; currency?: string; show?: string[] }) {
  const value = (k: string) => {
    if (!figures) return null;
    if (k === "unreleased") return Math.max(0, figures.bac - figures.released);
    if (k === "over") return Math.max(0, -figures.available);
    return figures[k as keyof FundsFigures];
  };
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-neutral-600">
      {FUNDS_SERIES.filter((x) => show.includes(x.key)).map((x) => (
        <li key={x.key} className="flex items-center gap-1.5">
          <span aria-hidden className={cx("h-2.5 w-2.5 rounded-sm", x.hue ? HUE[x.hue].dot : "ws-hatch ring-1 ring-neutral-300")} />
          {x.label}
          {figures && <span className="font-semibold tabular-nums text-neutral-900">{compact(value(x.key), currency as "NGN")}</span>}
        </li>
      ))}
    </ul>
  );
}
