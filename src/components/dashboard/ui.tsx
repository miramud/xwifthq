"use client";

/* ------------------------------------------------------------------ */
/*  Shared presentational primitives for the instructor + admin        */
/*  dashboards. Keeps the many feature pages consistent and DRY.       */
/* ------------------------------------------------------------------ */

import { useState } from "react";
import Link from "next/link";
import { MoreHorizontal, type LucideIcon } from "lucide-react";

/* ---------- page heading ----------------------------------------- */

export function PageHeading({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2
          className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {title}
        </h2>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      {children && (
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      )}
    </div>
  );
}

/* ---------- breadcrumb back link --------------------------------- */

export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-primary-600"
    >
      <span aria-hidden>←</span>
      {label}
    </Link>
  );
}

/* ---------- card with optional header ---------------------------- */

export function SectionCard({
  title,
  subtitle,
  action,
  children,
  className = "",
  bodyClassName = "p-5",
}: {
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div
      className={`overflow-hidden rounded-[1.25rem] border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgb(16_18_31/0.03),0_10px_28px_-14px_rgb(150_56_205/0.22)] ${className}`}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-1 pt-5">
          <div className="min-w-0">
            {title && (
              <h3 className="text-base font-bold tracking-tight text-neutral-900">{title}</h3>
            )}
            {/*
              Subtitle is Slate, not neutral-400. #7e9494 on white is 3.2:1, 
              fine for a glyph, a fail for text. It reads as correct on the dark
              admin rail, where the same token clears 5:1, which is how it got
              here in the first place.
            */}
            {subtitle && (
              <p className="text-xs text-neutral-500">{subtitle}</p>
            )}
          </div>
          {action}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </div>
  );
}

/* ---------- status pill ------------------------------------------ */

export type Tone =
  | "primary"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "accent"
  | "neutral";

/*
  Every pair here is measured against the ground the tint actually composites
  to on a white card, not against white, a 10% wash lifts the background and
  eats roughly a fifth of the ratio. A pill is 12px type, so 4.5:1 is the bar.

  Two of these were below it and are stepped down a rung:

  - `error` was error-600 on #fdecec at 4.23:1. error-700 is 5.66:1.
  - `accent` was gold *text* at accent-600, 3.20:1 on #fdf6eb, and the brand
    forbids it outright regardless of ground: gold below accent-700 is an icon
    colour, never a word. accent-700 is 5.13:1.

  The rest already clear it: success 4.60, warning 4.60, info 5.37, primary
  10.63, neutral 4.97.
*/
const TONE_STYLE: Record<Tone, string> = {
  primary: "bg-primary-50 text-primary-700",
  success: "bg-mint-50 text-mint-700",
  warning: "bg-sun-50 text-sun-700",
  error: "bg-error-500/10 text-error-700",
  info: "bg-sky-50 text-sky-700",
  accent: "bg-grape-50 text-grape-700",
  neutral: "bg-neutral-100 text-neutral-600",
};

export function Pill({
  tone = "neutral",
  dot = false,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_STYLE[tone]}`}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ---------- segmented tabs --------------------------------------- */

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  size = "md",
}: {
  tabs: { key: T; label: string; count?: number }[];
  active: T;
  onChange: (key: T) => void;
  size?: "sm" | "md";
}) {
  return (
    <div
      className={`inline-flex flex-wrap rounded-xl bg-neutral-100 p-1 ${
        size === "sm" ? "text-xs" : "text-sm"
      } font-medium`}
    >
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-pressed={on}
            className={`cursor-pointer rounded-lg px-3 py-1.5 font-semibold transition-colors ${
              on
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
            {t.count != null && (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] tnum ${
                  on ? "bg-primary-100 text-primary-700" : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- filter pills (single select) ------------------------- */

export function FilterPills<T extends string>({
  options,
  active,
  onChange,
}: {
  options: readonly T[];
  active: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-xl border border-neutral-200 bg-white p-1 text-xs font-semibold">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={active === o}
          className={`cursor-pointer rounded-lg px-3 py-1.5 transition-colors ${
            active === o
              ? "bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-sm shadow-primary-600/25"
              : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

/* ---------- search box -------------------------------------------- */

export function SearchBox({
  value,
  onChange,
  placeholder = "Search…",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative ${className}`}>
      <svg
        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
      />
    </div>
  );
}

/* ---------- avatar ----------------------------------------------- */

export function Avatar({
  initials,
  color,
  gradient,
  size = 36,
  src,
  alt,
}: {
  initials: string;
  color?: string;
  gradient?: string;
  size?: number;
  /** An uploaded photo. Falls back to the initials tile when absent. */
  src?: string | null;
  alt?: string;
}) {
  if (src) {
    return (
      // Cloudinary delivers these from an arbitrary host, so next/image would
      // need a remotePatterns entry per cloud. A plain <img> is the honest fit.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt ?? initials}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${
        gradient ? `bg-gradient-to-br ${gradient}` : ""
      }`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: gradient ? undefined : color ?? "#9638CD",
      }}
    >
      {initials}
    </span>
  );
}

/* ---------- course thumbnail (gradient + initials) --------------- */

/**
 * Course cover tile. Re-exported from the shared component so the dashboards and
 * the public catalog render the uploaded thumbnail (or its gradient fallback)
 * the same way.
 */
export { CourseThumb } from "@/components/shared/CourseCover";

/* ---------- progress bar ----------------------------------------- */

export function ProgressBar({
  value,
  className = "w-full",
  tone,
}: {
  value: number;
  className?: string;
  tone?: string;
}) {
  const color =
    tone ??
    (value >= 75
      ? "bg-mint-500 bg-gradient-to-r from-mint-500 to-mint-400"
      : value >= 40
        ? "bg-primary-500 bg-gradient-to-r from-primary-500 to-primary-400"
        : "bg-sun-500 bg-gradient-to-r from-sun-500 to-sun-300");
  return (
    <div className={`ws-hatch h-2 overflow-hidden rounded-full bg-primary-50 ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/* ---------- empty state ------------------------------------------ */

export function EmptyState({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-14 text-center">
      <span className="mb-1 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
        <Icon size={24} aria-hidden />
      </span>
      <p className="text-[15px] font-semibold text-neutral-900">{title}</p>
      {hint && <p className="max-w-sm text-sm text-neutral-500">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

/* ---------- mini stat tile (icon + value + label) ---------------- */

export function StatTile({
  icon: Icon,
  label,
  value,
  iconColor = "text-primary-600",
  iconBg = "bg-primary-50",
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  iconColor?: string;
  iconBg?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-[1.25rem] border border-neutral-200/70 bg-white shadow-[0_1px_2px_rgb(16_18_31/0.03),0_10px_28px_-14px_rgb(150_56_205/0.22)] p-5">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconBg}`}
      >
        <Icon size={21} className={iconColor} aria-hidden />
      </div>
      <div className="min-w-0">
        <p
          className="text-[22px] font-bold leading-tight tracking-tight text-neutral-900 tnum"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          {value}
        </p>
        <p className="truncate text-xs text-neutral-500">{label}</p>
        {hint && <p className="truncate text-[11px] text-neutral-500">{hint}</p>}
      </div>
    </div>
  );
}

/* ---------- row action menu (kebab dropdown) --------------------- */

export interface ActionItem {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
  danger?: boolean;
}

export function ActionMenu({
  items,
  label = "Actions",
  align = "right",
}: {
  items: ActionItem[];
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);

  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <span className="relative inline-block" onClick={stop}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(e) => {
          stop(e);
          setOpen((v) => !v);
        }}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
      >
        <MoreHorizontal size={18} />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            onClick={(e) => {
              stop(e);
              setOpen(false);
            }}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div
            role="menu"
            className={`absolute z-50 mt-1 w-48 overflow-hidden rounded-2xl border border-neutral-200 bg-white p-1 shadow-2xl shadow-neutral-900/10 animate-fade-in ${
              align === "right" ? "right-0" : "left-0"
            }`}
          >
            {items.map((item, i) => {
              const Icon = item.icon;
              /*
                error-700, not error-600, for the same reason as the pill: the
                hover wash composites to #fdecec, and error-600 on it is 4.23:1.
                The colour a row is legible in must be the colour it stays
                legible in once you point at it.
              */
              const cls = `flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                item.danger
                  ? "text-error-700 hover:bg-error-500/10"
                  : "text-neutral-700 hover:bg-neutral-50"
              }`;
              const inner = (
                <>
                  {Icon && <Icon size={15} className="shrink-0" />}
                  <span className="flex-1">{item.label}</span>
                </>
              );
              if (item.href) {
                return (
                  <Link
                    key={i}
                    href={item.href}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={cls}
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={i}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    stop(e);
                    setOpen(false);
                    item.onClick?.();
                  }}
                  className={cls}
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </>
      )}
    </span>
  );
}

/* ---------- star rating ------------------------------------------ */

export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg
          key={i}
          width={size}
          height={size}
          viewBox="0 0 24 24"
          className={i <= Math.round(rating) ? "fill-warning-400 text-warning-400" : "fill-neutral-200 text-neutral-200"}
          aria-hidden
        >
          <path d="M12 2l2.9 6.3 6.9.6-5.2 4.6 1.6 6.8L12 17.3 5.8 20.9l1.6-6.8L2.2 8.9l6.9-.6z" />
        </svg>
      ))}
    </span>
  );
}
