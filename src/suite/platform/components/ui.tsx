"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, RotateCcw } from "lucide-react";
import { Button, Card, Chip, cx } from "@/components/workspace/kit";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import { formatCompactNaira, formatDate, timeAgo } from "@/lib/console-data";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { ApiError, type AlertSeverity } from "@/lib/api/platform-client";

/*
  Pieces the platform console repeats: money in kobo, severity, paging,
  load failures and a compact target bar. Built from kit tokens only.
*/

/* ------------------------------------------------------------------ */
/*  Money                                                              */
/* ------------------------------------------------------------------ */

const NAIRA = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 2 });

/** ₦1,234.50: for tables and anything somebody will reconcile against. */
export function naira(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "-";
  return NAIRA.format(kobo / 100);
}

/** ₦1.2M: for headline figures only. */
export function nairaCompact(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "-";
  return formatCompactNaira(Math.round(kobo / 100));
}

/** Percentage change, rounded; null when there is nothing to compare with. */
export function percentChange(now: number, before: number): number | null {
  if (before <= 0) return null;
  return Math.round(((now - before) / before) * 100);
}

/* ------------------------------------------------------------------ */
/*  Time                                                               */
/* ------------------------------------------------------------------ */

/** "3h ago", with the exact moment on hover and for screen readers. */
export function When({ at, className }: { at: string | null | undefined; className?: string }) {
  if (!at) return <span className={className}>-</span>;
  const exact = new Date(at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  return (
    <time dateTime={at} title={exact} className={cx("tabular-nums", className)}>
      {timeAgo(at)}
    </time>
  );
}

export { formatDate };

/* ------------------------------------------------------------------ */
/*  Modules and severity                                               */
/* ------------------------------------------------------------------ */

const MODULE_HUE: Record<string, Hue> = {
  core: "slate",
  lms: "grape",
  hrm: "coral",
  projects: "sky",
  finance: "mint",
  admin: "sun",
};

export function moduleHue(key: string): Hue {
  return MODULE_HUE[key] ?? hueFor(key);
}

export function ModuleChip({ moduleKey, label }: { moduleKey: string; label?: string }) {
  return (
    <Chip hue={moduleHue(moduleKey)} dot>
      {label ?? moduleKey.toUpperCase()}
    </Chip>
  );
}

const SEVERITY: Record<AlertSeverity, { hue: Hue; icon: typeof Info; label: string }> = {
  critical: { hue: "rose", icon: AlertOctagon, label: "Critical" },
  warning: { hue: "sun", icon: AlertTriangle, label: "Warning" },
  info: { hue: "sky", icon: Info, label: "Info" },
};

export const SEVERITY_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

export function severityOf(s: string): AlertSeverity {
  return s === "critical" || s === "warning" ? s : "info";
}

export function SeverityChip({ severity }: { severity: string }) {
  const s = SEVERITY[severityOf(severity)];
  return (
    <Chip hue={s.hue} icon={s.icon}>
      {s.label}
    </Chip>
  );
}

export function SeverityIcon({ severity, size = 16 }: { severity: string; size?: number }) {
  const s = SEVERITY[severityOf(severity)];
  const Icon = s.icon;
  return (
    <span className={cx("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", HUE[s.hue].soft)} aria-hidden>
      <Icon size={size} />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading                                                            */
/* ------------------------------------------------------------------ */

interface Settled<T> {
  fetcher: (() => Promise<T>) | null;
  nonce: number;
  data: T | null;
  error: string | null;
}

/**
 * Fetch whenever `fetcher` changes (make it a `useCallback` over its inputs),
 * and on `reload()`.
 *
 * State is only ever set when a request settles, never synchronously in the
 * effect, and "loading" is derived by comparing the request in flight with the
 * one that last settled, so the previous result stays on screen while a
 * filter change fetches the next one, and a stale response can't overwrite a
 * newer one.
 */
export function useLoad<T>(fetcher: () => Promise<T>, fallbackMessage: string) {
  const [nonce, setNonce] = useState(0);
  const [settled, setSettled] = useState<Settled<T>>({ fetcher: null, nonce: -1, data: null, error: null });

  useEffect(() => {
    let alive = true;
    fetcher().then(
      (data) => {
        if (alive) setSettled({ fetcher, nonce, data, error: null });
      },
      (e: unknown) => {
        if (alive)
          setSettled((s) => ({
            fetcher,
            nonce,
            data: s.data,
            error: e instanceof ApiError ? e.message : fallbackMessage,
          }));
      },
    );
    return () => {
      alive = false;
    };
  }, [fetcher, nonce, fallbackMessage]);

  const loading = settled.fetcher !== fetcher || settled.nonce !== nonce;
  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const setData = useCallback(
    (update: (d: T | null) => T | null) => setSettled((s) => ({ ...s, data: update(s.data) })),
    [],
  );

  return { data: settled.data, error: loading ? null : settled.error, loading, reload, setData };
}

/* ------------------------------------------------------------------ */
/*  Load states                                                        */
/* ------------------------------------------------------------------ */

/** A failed load says what failed and offers the one thing that helps. */
export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-2xl border border-error-500/20 bg-error-500/5 px-5 py-4 text-sm text-error-700 sm:flex-row sm:items-center sm:justify-between"
    >
      <span className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-error-600 shadow-sm" aria-hidden>
          <AlertTriangle size={16} />
        </span>
        <span className="pt-2">{message}</span>
      </span>
      <Button size="sm" icon={RotateCcw} onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

/** Stat row + one big panel, the shape most platform pages load into. */
export function PageSkeleton({ stats = 4, rows = 1 }: { stats?: number; rows?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: stats }, (_, i) => (
          <Skeleton key={i} className="h-[104px] rounded-[1.25rem]" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-72 rounded-[1.25rem]" />
      ))}
    </div>
  );
}

/** A success line that confirms what just happened. */
export function Notice({ children, onDismiss }: { children: React.ReactNode; onDismiss?: () => void }) {
  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-2xl border border-mint-500/20 bg-mint-50 px-4 py-3 text-sm text-mint-700"
    >
      <span className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm" aria-hidden>
          <CheckCircle2 size={16} />
        </span>
        <span className="pt-1.5">{children}</span>
      </span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-9 cursor-pointer rounded-lg px-2 text-xs font-semibold outline-none hover:underline focus-visible:ring-2 focus-visible:ring-mint-500"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Paging                                                             */
/* ------------------------------------------------------------------ */

export function Pager({
  page,
  lastPage,
  total,
  onPage,
  noun = "items",
}: {
  page: number;
  lastPage: number;
  total: number;
  onPage: (page: number) => void;
  noun?: string;
}) {
  if (lastPage <= 1) {
    return <p className="mt-3 text-xs text-neutral-500 tabular-nums">{total.toLocaleString("en-NG")} {noun}</p>;
  }
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-between gap-3 text-sm text-neutral-600">
      <span className="tabular-nums">
        Page {page} of {lastPage} · {total.toLocaleString("en-NG")} {noun}
      </span>
      <span className="flex gap-2">
        <Button size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button size="sm" disabled={page >= lastPage} onClick={() => onPage(page + 1)}>
          Next
          <ChevronRight size={15} aria-hidden />
        </Button>
      </span>
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Bullet bar                                                         */
/* ------------------------------------------------------------------ */

/** The gradient a bullet fills with, brightening towards its end, as kit `Progress` does. */
const BULLET_FILL: Record<Hue, string> = {
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
 * One measure against its ceiling, value always printed beside it: seats used
 * of seats sold, organisations on a module of all organisations. The unused
 * remainder takes the workspace hatch, as every "not yet" does.
 */
export function Bullet({
  label,
  value,
  max,
  hue = "blue",
  format = (v) => v.toLocaleString("en-NG"),
  note,
}: {
  label: string;
  value: number;
  max: number;
  hue?: Hue;
  format?: (v: number) => string;
  note?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-medium text-neutral-800">{label}</span>
        <span className="tabular-nums text-neutral-600">
          <span className="font-semibold text-neutral-900">{format(value)}</span> / {format(max)}
          <span className="ml-1.5 text-xs text-neutral-500">({pct}%)</span>
        </span>
      </div>
      <div
        className="ws-hatch relative h-2.5 overflow-hidden rounded-full"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
      >
        <div className={cx("h-full rounded-full bg-gradient-to-r", HUE[hue].bar, BULLET_FILL[hue])} style={{ width: `${pct}%` }} />
      </div>
      {note && <p className="mt-1 text-xs text-neutral-500">{note}</p>}
    </div>
  );
}

/** A card that says "nothing to show yet" in the page's own voice. */
export function QuietCard({ children }: { children: React.ReactNode }) {
  return <Card className="px-5 py-12 text-center text-sm text-neutral-500">{children}</Card>;
}
