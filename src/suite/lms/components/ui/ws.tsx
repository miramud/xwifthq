"use client";

import Link from "next/link";
import { ArrowDownRight, ArrowLeft, ArrowUpRight, ChevronRight, Star, type LucideIcon } from "lucide-react";
import { Chip, StatCard as KitStatCard, cx, initialsOf } from "@/components/workspace/kit";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";
import { CourseCover } from "@/components/shared/CourseCover";

/*
  Small workspace pieces the Learning console, the teaching studio and the
  organisation console all need but the kit does not (yet) carry: status
  chips with one colour per status word, information rows, an activity
  timeline, a course card for DataView grids, list-panel rows and the form
  control classes. Built only from kit parts and HUE tokens, so they read as
  the same product. Candidates for promotion into components/workspace/.
*/

/* ------------------------------------------------------------------ */
/*  Status                                                             */
/* ------------------------------------------------------------------ */

const STATUS_HUE: Record<string, Hue> = {
  published: "mint",
  active: "mint",
  approved: "mint",
  completed: "mint",
  complete: "mint",
  verified: "mint",
  valid: "mint",
  resolved: "mint",
  answered: "mint",
  healthy: "mint",
  ok: "mint",
  paid: "mint",
  compliant: "mint",
  on_track: "mint",
  draft: "sun",
  pending: "sun",
  in_review: "sun",
  review: "sun",
  pending_review: "sun",
  in_progress: "blue",
  open: "blue",
  new: "blue",
  invited: "sky",
  scheduled: "sky",
  due_soon: "sun",
  warning: "sun",
  unanswered: "coral",
  overdue: "coral",
  expired: "coral",
  failed: "rose",
  rejected: "rose",
  revoked: "rose",
  suspended: "rose",
  blocked: "rose",
  error: "rose",
  closed: "slate",
  archived: "slate",
  inactive: "slate",
  disabled: "slate",
  not_started: "slate",
};

/** A stable hue per status word, so "draft" is amber on every screen. */
export function statusHue(status: string | null | undefined): Hue {
  if (!status) return "slate";
  return STATUS_HUE[status.toLowerCase().replace(/[\s-]+/g, "_")] ?? "slate";
}

export function humanise(s: string | null | undefined): string {
  if (!s) return "";
  const t = s.replace(/[_-]+/g, " ").trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** A status word on its own wash, with a dot — never colour alone. */
export function StatusChip({
  status,
  label,
  hue,
  icon,
}: {
  status: string | null | undefined;
  label?: React.ReactNode;
  hue?: Hue;
  icon?: LucideIcon;
}) {
  return (
    <Chip hue={hue ?? statusHue(status)} dot={!icon} icon={icon}>
      {label ?? humanise(status)}
    </Chip>
  );
}

/* ------------------------------------------------------------------ */
/*  Navigation                                                         */
/* ------------------------------------------------------------------ */

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="mb-3 inline-flex h-9 items-center gap-1.5 rounded-xl pr-2 text-sm font-medium text-neutral-500 outline-none transition-colors hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300"
    >
      <ArrowLeft size={16} aria-hidden />
      {label}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Information rows                                                   */
/* ------------------------------------------------------------------ */

/** Icon tile, label, value — the detail page's information row. */
export function InfoRow({
  icon: Icon,
  label,
  children,
  hue = "slate",
}: {
  icon: LucideIcon;
  label: string;
  children: React.ReactNode;
  hue?: Hue;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)}>
        <Icon size={16} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-neutral-500">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium text-neutral-900">{children}</dd>
      </div>
    </div>
  );
}

export function InfoList({ children, cols = 1 }: { children: React.ReactNode; cols?: 1 | 2 }) {
  return (
    <dl className={cx("grid gap-x-6", cols === 2 ? "sm:grid-cols-2" : "grid-cols-1", "divide-neutral-100")}>
      {children}
    </dl>
  );
}

/* ------------------------------------------------------------------ */
/*  List panel rows                                                    */
/* ------------------------------------------------------------------ */

/**
 * One row of a list panel: something on the left (avatar, thumb, icon tile),
 * a title and a line of meta, and something on the right.
 */
export function ListRow({
  leading,
  title,
  meta,
  trailing,
  href,
}: {
  leading?: React.ReactNode;
  title: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      {leading && <span className="shrink-0">{leading}</span>}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-neutral-900">{title}</span>
        {meta && <span className="mt-0.5 block truncate text-xs text-neutral-500">{meta}</span>}
      </span>
      {trailing && <span className="shrink-0">{trailing}</span>}
      {href && <ChevronRight size={16} className="shrink-0 text-neutral-400" aria-hidden />}
    </>
  );
  const cls = "flex items-center gap-3 rounded-xl px-2 py-2.5";
  return href ? (
    <li>
      <Link
        href={href}
        className={cx(cls, "outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300")}
      >
        {inner}
      </Link>
    </li>
  ) : (
    <li className={cls}>{inner}</li>
  );
}

/** An icon on a hue wash, the leading slot of list rows and stat blocks. */
export function IconTile({ icon: Icon, hue = "blue", size = 36 }: { icon: LucideIcon; hue?: Hue; size?: number }) {
  return (
    <span
      className={cx("flex shrink-0 items-center justify-center rounded-xl", HUE[hue].soft)}
      style={{ width: size, height: size }}
    >
      <Icon size={Math.round(size * 0.46)} aria-hidden />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Activity timeline                                                  */
/* ------------------------------------------------------------------ */

export interface TimelineItem {
  id: string;
  who?: string | null;
  avatar?: string | null;
  icon?: LucideIcon;
  hue?: Hue;
  text: React.ReactNode;
  when?: React.ReactNode;
}

/** Deli-Plany's activity column: avatar, what happened, when, joined by a rule. */
export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <div className="relative">
    <span className="absolute bottom-2 left-[15px] top-2 w-px bg-neutral-200" aria-hidden />
    <ol className="relative space-y-5">
      {items.map((it) => (
        <li key={it.id} className="relative flex gap-3">
          {it.icon ? (
            <span className="relative z-[1] rounded-full ring-4 ring-white">
              <IconTile icon={it.icon} hue={it.hue ?? "blue"} size={32} />
            </span>
          ) : (
            <span className="relative z-[1] rounded-full ring-4 ring-white">
              <FaceAvatar name={it.who ?? "?"} src={it.avatar} size={32} />
            </span>
          )}
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="text-sm text-neutral-700">
              {it.who && <span className="font-semibold text-neutral-900">{it.who} </span>}
              {it.text}
            </p>
            {it.when && <p className="mt-0.5 text-xs text-neutral-500">{it.when}</p>}
          </div>
        </li>
      ))}
    </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Course card (DataView grid)                                        */
/* ------------------------------------------------------------------ */

/**
 * The grid card for anything with a course cover: banner with a status chip
 * on it, title, a line of meta, chips, an optional progress bar and footer.
 */
export function CoverCard({
  title,
  gradient,
  thumbnailUrl,
  badge,
  eyebrow,
  subtitle,
  chips,
  children,
  footer,
}: {
  title: string;
  gradient?: string | null;
  thumbnailUrl?: string | null;
  badge?: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  chips?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="p-2 pb-0">
        <CourseCover
          title={title}
          gradient={gradient}
          thumbnailUrl={thumbnailUrl}
          className="aspect-[16/8] rounded-[0.8rem]"
        >
          {badge && <div className="flex h-full items-start justify-end p-2.5">{badge}</div>}
        </CourseCover>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 truncate text-[11px] font-semibold uppercase tracking-wide text-primary-700">{eyebrow}</p>
          )}
          <p className="line-clamp-2 text-[15px] font-semibold leading-snug text-neutral-900">{title}</p>
          {subtitle && <p className="mt-1 truncate text-xs text-neutral-500">{subtitle}</p>}
        </div>
        {chips && <div className="flex flex-wrap gap-1.5">{chips}</div>}
        {children}
        {footer && (
          <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** A person card for DataView grids: avatar, name, a line, chips, footer. */
export function PersonCard({
  name,
  src,
  subtitle,
  chips,
  children,
  footer,
  trailing,
}: {
  name: string;
  src?: string | null;
  subtitle?: React.ReactNode;
  chips?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <FaceAvatar name={name} src={src} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{name}</p>
          {subtitle && <p className="mt-0.5 truncate text-xs text-neutral-500">{subtitle}</p>}
        </div>
        {trailing}
      </div>
      {chips && <div className="flex flex-wrap gap-1.5">{chips}</div>}
      {children}
      {footer && (
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-neutral-100 pt-3 text-xs text-neutral-500">
          {footer}
        </div>
      )}
    </div>
  );
}

/** Rating as a star and a number, for chips and table cells. */
export function Rating({ value, count }: { value: number | null | undefined; count?: number | null }) {
  if (value == null || Number.isNaN(Number(value))) return <span className="text-neutral-500">No ratings</span>;
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <Star size={13} className="fill-sun-400 text-sun-400" aria-hidden />
      <span className="font-semibold text-neutral-900">{Number(value).toFixed(1)}</span>
      {count != null && <span className="text-neutral-500">({count})</span>}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Forms                                                              */
/* ------------------------------------------------------------------ */

/** A text input / select in the workspace: 44px, 12px radius, blue focus. */
export const inputClass =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-50 disabled:text-neutral-500";

export const selectClass = cx(inputClass, "cursor-pointer pr-9");

export const textareaClass =
  "w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-neutral-50";

export const labelClass = "mb-1.5 block text-sm font-medium text-neutral-700";

export const hintClass = "mt-1.5 text-xs text-neutral-500";

/** The error banner a page shows when a load or save fails. */
export function ErrorNote({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      role="alert"
      className={cx("rounded-xl border border-error-500/20 bg-error-500/5 px-4 py-3 text-sm text-error-700", className)}
    >
      {children}
    </div>
  );
}

/** A loading placeholder in the card shape: pulses, then the page arrives. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-[1.125rem] bg-neutral-200/60", className)} aria-hidden />;
}

/* ------------------------------------------------------------------ */
/*  Stat card with a working featured variant                          */
/* ------------------------------------------------------------------ */

/*
  The kit's StatCard paints its featured card with a gradient utility on top
  of `ws-card` — but `.ws .ws-card { background: #fff }` is unlayered CSS and
  beats every Tailwind utility, so the featured card renders white text on a
  white card. Until the kit is fixed, this wrapper draws the featured card
  without `ws-card` and defers to the kit for every other card.
*/

const FEATURED_BG: Record<Hue, string> = {
  blue: "bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-primary-600/25",
  grape: "bg-gradient-to-br from-grape-600 to-grape-500 text-white shadow-grape-500/25",
  sky: "bg-gradient-to-br from-sky-600 to-sky-500 text-white shadow-sky-500/25",
  mint: "bg-gradient-to-br from-mint-600 to-mint-500 text-white shadow-mint-500/25",
  coral: "bg-gradient-to-br from-coral-600 to-coral-500 text-white shadow-coral-500/25",
  rose: "bg-gradient-to-br from-rose-600 to-rose-500 text-white shadow-rose-500/25",
  sun: "bg-gradient-to-br from-sun-500 to-sun-400 text-neutral-900 shadow-sun-500/25",
  slate: "bg-gradient-to-br from-neutral-800 to-neutral-700 text-white shadow-neutral-900/20",
};

export function StatCard(props: React.ComponentProps<typeof KitStatCard> & { featuredHue?: Hue }) {
  const { featured, featuredHue = "blue", ...rest } = props;
  if (!featured) return <KitStatCard {...rest} />;
  const { label, value, unit, icon: Icon, delta, deltaLabel, hint, href } = rest;
  const up = delta != null && delta > 0;
  const body = (
    <div
      className={cx(
        "relative flex h-full flex-col gap-4 overflow-hidden rounded-[1.125rem] p-5 shadow-lg transition-shadow",
        FEATURED_BG[featuredHue],
        href && "hover:shadow-xl",
      )}
    >
      <span className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-white/10" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-medium opacity-90">{label}</p>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20">
            <Icon size={18} aria-hidden />
          </span>
        )}
      </div>
      <div className="relative">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums">{value}</span>
          {unit && <span className="text-sm font-medium opacity-80">{unit}</span>}
        </p>
        {(delta != null || deltaLabel || hint) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {delta != null && delta !== 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-white/20 px-1.5 py-0.5 font-semibold tabular-nums">
                {up ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
                {Math.abs(delta)}%<span className="sr-only">{up ? " up" : " down"}</span>
              </span>
            )}
            {deltaLabel && <span className="opacity-85">{deltaLabel}</span>}
            {hint && <span className="opacity-85">{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[1.125rem] outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
      {body}
    </Link>
  ) : (
    body
  );
}

/* ------------------------------------------------------------------ */
/*  Form pieces                                                        */
/* ------------------------------------------------------------------ */

/** A labelled field: the label is tied to the control by `htmlFor`. */
export function Field({
  id,
  label,
  hint,
  children,
  className,
}: {
  id?: string;
  label: React.ReactNode;
  /** A short note on the right of the label: "Required", "One sentence". */
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-neutral-700">
          {label}
        </label>
        {hint && <span className="text-xs text-neutral-500">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/** An on/off switch with an accessible name. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-300 disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "bg-primary-600" : "bg-neutral-200",
      )}
    >
      <span
        className={cx(
          "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

/** A setting row: title and a line of help on the left, a control on the right. */
export function SettingRow({
  title,
  hint,
  children,
}: {
  title: React.ReactNode;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-neutral-200/80 bg-neutral-50/50 px-4 py-3.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-neutral-900">{title}</p>
        {hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

/** The bar a long form ends with: sticky at the bottom of the viewport. */
export function FormActions({ children, note }: { children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 z-10 -mx-4 border-t border-neutral-200/80 bg-white/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-neutral-500">{note}</div>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">{children}</div>
      </div>
    </div>
  );
}

/**
 * A decorative avatar for a row that already prints the person's name beside
 * it: the kit's PersonAvatar adds the name again for screen readers, which
 * doubles it for them (and for any test that finds the row by its name).
 */
const FACE_BG: Record<Hue, string> = {
  blue: "bg-primary-100 text-primary-700",
  coral: "bg-coral-100 text-coral-700",
  mint: "bg-mint-100 text-mint-700",
  grape: "bg-grape-100 text-grape-700",
  sun: "bg-sun-100 text-sun-700",
  sky: "bg-sky-100 text-sky-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-neutral-200 text-neutral-700",
};

export function FaceAvatar({ name, src, size = 32 }: { name: string | null | undefined; src?: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" aria-hidden style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden
      style={style}
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", FACE_BG[hueFor(name)])}
    >
      {initialsOf(name)}
    </span>
  );
}
