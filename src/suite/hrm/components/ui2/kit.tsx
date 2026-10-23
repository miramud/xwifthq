"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/dashboard/ui";
import { Card, Empty, PersonAvatar, cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import { hueHex } from "@/components/workspace/charts";
import { pad } from "@/components/workspace/Calendar";

/*
  HR-specific furniture that sits on top of the workspace kit.

  The HR format helpers (`leaveTone`, `payRunTone`, …) speak in the older
  `Tone` vocabulary; these translate it into the kit's hues so a status looks
  the same on every redesigned HR page. Anything here that turns out to be
  generic belongs in `components/workspace/` — it lives here only because the
  kit is shared with other modules and is edited separately.
*/

/* ------------------------------------------------------------------ */
/*  Tones → hues                                                       */
/* ------------------------------------------------------------------ */

export function toneHue(tone: Tone): Hue {
  switch (tone) {
    case "success":
      return "mint";
    case "warning":
      return "sun";
    case "error":
      return "rose";
    case "info":
      return "sky";
    case "accent":
      return "grape";
    case "primary":
      return "blue";
    default:
      return "slate";
  }
}

/**
 * A status chip from a `Tone`. `error` keeps the semantic error wash rather
 * than a decorative hue — a refusal should not look like a category.
 */
export function ToneChip({
  tone = "neutral",
  dot = false,
  icon: Icon,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  const wash = tone === "error" ? "bg-error-500/10 text-error-700" : HUE[toneHue(tone)].soft;
  const dotCls = tone === "error" ? "bg-error-600" : HUE[toneHue(tone)].dot;
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        wash,
        className,
      )}
    >
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", dotCls)} aria-hidden />}
      {Icon && <Icon size={12} aria-hidden />}
      {children}
    </span>
  );
}

/* Pastel surfaces, spelled out so Tailwind sees every class. */
export const PASTEL: Record<Hue, { card: string; ink: string; sub: string; tile: string }> = {
  blue: { card: "bg-primary-50 border-primary-100", ink: "text-primary-800", sub: "text-primary-700", tile: "bg-white text-primary-700" },
  coral: { card: "bg-coral-50 border-coral-100", ink: "text-coral-700", sub: "text-coral-700", tile: "bg-white text-coral-700" },
  mint: { card: "bg-mint-50 border-mint-100", ink: "text-mint-700", sub: "text-mint-700", tile: "bg-white text-mint-700" },
  grape: { card: "bg-grape-50 border-grape-100", ink: "text-grape-700", sub: "text-grape-700", tile: "bg-white text-grape-700" },
  sun: { card: "bg-sun-50 border-sun-100", ink: "text-sun-700", sub: "text-sun-700", tile: "bg-white text-sun-700" },
  sky: { card: "bg-sky-50 border-sky-100", ink: "text-sky-700", sub: "text-sky-700", tile: "bg-white text-sky-700" },
  rose: { card: "bg-rose-50 border-rose-100", ink: "text-rose-700", sub: "text-rose-700", tile: "bg-white text-rose-700" },
  slate: { card: "bg-neutral-100 border-neutral-200", ink: "text-neutral-800", sub: "text-neutral-600", tile: "bg-white text-neutral-700" },
};

/**
 * A pastel card — Panze's task cards. A hue wash, an icon tile, a label and a
 * big figure; children go underneath (usually a hatched Progress).
 */
export function PastelCard({
  hue,
  icon: Icon,
  label,
  value,
  unit,
  sub,
  children,
  className,
}: {
  hue: Hue;
  icon?: LucideIcon;
  label: React.ReactNode;
  value?: React.ReactNode;
  unit?: string;
  sub?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  const p = PASTEL[hue];
  return (
    <div className={cx("flex flex-col gap-3 rounded-[1.125rem] border p-5", p.card, className)}>
      <div className="flex items-start justify-between gap-3">
        <p className={cx("text-sm font-semibold", p.ink)}>{label}</p>
        {Icon && (
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm", p.tile)}>
            <Icon size={18} aria-hidden />
          </span>
        )}
      </div>
      {value !== undefined && (
        <p className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-bold leading-none tracking-tight text-neutral-900 tabular-nums">{value}</span>
          {unit && <span className="text-sm font-medium text-neutral-600">{unit}</span>}
        </p>
      )}
      {sub && <p className="text-xs text-neutral-600">{sub}</p>}
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading, failure, notices                                          */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-[1.125rem] border border-neutral-200/80 bg-white", className ?? "h-64")} aria-hidden />;
}

/** A page-shaped placeholder: stat row, then a big card. */
export function PageSkeleton({ stats = 4 }: { stats?: number }) {
  return (
    <div className="space-y-6" aria-busy="true">
      {stats > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: stats }, (_, i) => (
            <Skeleton key={i} className="h-[124px]" />
          ))}
        </div>
      )}
      <Skeleton className="h-80" />
    </div>
  );
}

export function LoadFailed({
  message,
  title = "That did not load",
  icon = AlertTriangle,
}: {
  message: string;
  title?: string;
  icon?: LucideIcon;
}) {
  return (
    <Card>
      <Empty icon={icon} hue="coral" title={title} hint={message} />
    </Card>
  );
}

const NOTICE: Record<"error" | "success" | "info" | "warning", { cls: string; icon: LucideIcon }> = {
  error: { cls: "border-error-500/20 bg-error-500/10 text-error-700", icon: XCircle },
  success: { cls: "border-mint-100 bg-mint-50 text-mint-700", icon: CheckCircle2 },
  info: { cls: "border-sky-100 bg-sky-50 text-sky-700", icon: Info },
  warning: { cls: "border-sun-100 bg-sun-50 text-sun-700", icon: AlertTriangle },
};

export function Notice({
  tone = "info",
  children,
  className,
  role,
}: {
  tone?: "error" | "success" | "info" | "warning";
  children: React.ReactNode;
  className?: string;
  role?: "alert" | "status";
}) {
  const { cls, icon: Icon } = NOTICE[tone];
  return (
    <div role={role} className={cx("flex items-start gap-2.5 rounded-xl border px-3.5 py-2.5 text-sm", cls, className)}>
      <Icon size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Forms                                                              */
/* ------------------------------------------------------------------ */

export const inputCls =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-neutral-50";
export const selectCls = inputCls + " cursor-pointer pr-8";
export const textareaCls =
  "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100";
export const labelCls = "mb-1.5 block text-[13px] font-semibold text-neutral-700";
export const hintCls = "mt-1.5 block text-xs text-neutral-500";

/**
 * A modal frame in the workspace style: 18px card, title row with a close
 * button, Escape and backdrop close. Renders a `<form>` when given `onSubmit`
 * so Enter submits and `required` validates as before.
 */
export function ModalFrame({
  title,
  subtitle,
  icon: Icon,
  hue = "blue",
  onClose,
  onSubmit,
  children,
  footer,
  wide = false,
}: {
  title: string;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  hue?: Hue;
  onClose: () => void;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const inner = (
    <>
      <div className="flex items-start justify-between gap-3 border-b border-neutral-100 px-6 py-5">
        <div className="flex min-w-0 items-start gap-3">
          {Icon && (
            <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)}>
              <Icon size={19} aria-hidden />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold tracking-tight text-neutral-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-neutral-500">{subtitle}</p>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
        >
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="space-y-4 px-6 py-5">{children}</div>
      {footer && (
        <div className="flex flex-wrap justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">
          {footer}
        </div>
      )}
    </>
  );

  const box = cx("relative w-full overflow-hidden rounded-[1.25rem] sm:my-auto bg-white shadow-2xl", wide ? "max-w-2xl" : "max-w-lg");

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto overscroll-contain p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-neutral-900/40 backdrop-blur-[2px]"
      />
      {onSubmit ? (
        <form role="dialog" aria-modal="true" aria-label={title} onSubmit={onSubmit} className={box}>
          {inner}
        </form>
      ) : (
        <div role="dialog" aria-modal="true" aria-label={title} className={box}>
          {inner}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  People and facts                                                   */
/* ------------------------------------------------------------------ */

/** Avatar, name and a quiet second line; the name links when given `href`. */
export function PersonCell({
  name,
  sub,
  href,
  size = 36,
  src,
}: {
  name: string | null | undefined;
  sub?: React.ReactNode;
  href?: string;
  size?: number;
  src?: string | null;
}) {
  const label = name ?? "Unnamed";
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar name={label} src={src} size={size} />
      <div className="min-w-0">
        {href ? (
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="block truncate text-sm font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
          >
            {label}
          </Link>
        ) : (
          <p className="truncate text-sm font-semibold text-neutral-900">{label}</p>
        )}
        {sub && <p className="truncate text-xs text-neutral-500">{sub}</p>}
      </div>
    </div>
  );
}

/** An icon, a label and a value — the information rows of a detail panel. */
export function InfoRow({
  icon: Icon,
  label,
  value,
  hue = "slate",
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
  hue?: Hue;
}) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)}>
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-neutral-500">{label}</p>
        <div className="truncate text-sm font-semibold text-neutral-900">{value}</div>
      </div>
    </div>
  );
}

/** A small labelled figure for inside cards. */
export function MiniStat({ label, value, hue }: { label: string; value: React.ReactNode; hue?: Hue }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className={cx("mt-0.5 text-sm font-bold tabular-nums", hue ? HUE[hue].text : "text-neutral-900")}>{value}</p>
    </div>
  );
}

/**
 * Several parts of one whole on a single bar, the rest hatched: taken,
 * booked, left. Each part names itself in the legend underneath.
 */
export function StackBar({
  parts,
  total,
  label,
  showLegend = true,
  format = (v: number) => String(v),
}: {
  parts: { label: string; value: number; hue: Hue }[];
  total: number;
  label: string;
  showLegend?: boolean;
  format?: (v: number) => string;
}) {
  const denom = Math.max(total, parts.reduce((s, p) => s + Math.max(0, p.value), 0), 0.0001);
  return (
    <div>
      <div className="ws-hatch flex h-3 overflow-hidden rounded-full" role="img" aria-label={`${label}: ${parts.map((p) => `${p.label} ${format(p.value)}`).join(", ")} of ${format(total)}`}>
        {parts.map((p) =>
          p.value > 0 ? (
            <span
              key={p.label}
              className="h-full first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(p.value / denom) * 100}%`, background: hueHex(p.hue) }}
            />
          ) : null,
        )}
      </div>
      {showLegend && (
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-600">
          {parts.map((p) => (
            <li key={p.label} className="flex items-center gap-1.5">
              <span className={cx("h-2 w-2 rounded-full", HUE[p.hue].dot)} aria-hidden />
              {p.label} <span className="font-semibold tabular-nums text-neutral-800">{format(p.value)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** A date as a little calendar leaf: month over day. */
export function DateLeaf({ date, hue = "blue" }: { date: string; hue?: Hue }) {
  const d = new Date(`${date.slice(0, 10)}T12:00:00`);
  const valid = !Number.isNaN(d.getTime());
  return (
    <span className={cx("flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl", HUE[hue].soft)} aria-hidden>
      <span className="text-[10px] font-bold uppercase leading-none tracking-wide">
        {valid ? d.toLocaleDateString("en-GB", { month: "short" }) : "-"}
      </span>
      <span className="mt-0.5 text-lg font-bold leading-none tabular-nums">{valid ? d.getDate() : ""}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Bare-date helpers                                                  */
/* ------------------------------------------------------------------ */

export function addDays(day: string, n: number): string {
  const d = new Date(`${day.slice(0, 10)}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The Monday on or before `day`. */
export function mondayOf(day: string): string {
  const d = new Date(`${day.slice(0, 10)}T12:00:00`);
  return addDays(day, -((d.getDay() + 6) % 7));
}

export function weekOf(day: string, length = 7): string[] {
  const mon = mondayOf(day);
  return Array.from({ length }, (_, i) => addDays(mon, i));
}

/* ------------------------------------------------------------------ */
/*  Soft row actions                                                   */
/* ------------------------------------------------------------------ */

const SOFT_BTN: Record<"mint" | "blue" | "rose" | "sun", string> = {
  mint: "bg-mint-50 text-mint-700 hover:bg-mint-100 focus-visible:ring-mint-500",
  blue: "bg-primary-50 text-primary-700 hover:bg-primary-100 focus-visible:ring-primary-300",
  rose: "bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-500",
  sun: "bg-sun-50 text-sun-700 hover:bg-sun-100 focus-visible:ring-sun-500",
};

/**
 * A tinted small button for actions repeated on every row (Approve, Done):
 * a column of solid blue buttons would break "one primary per screen".
 */
export function SoftButton({
  hue = "mint",
  icon: Icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  hue?: "mint" | "blue" | "rose" | "sun";
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      className={cx(
        "inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold outline-none transition-colors focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        SOFT_BTN[hue],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={15} aria-hidden />}
      {children}
    </button>
  );
}
