"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { HUE, hueFor, type Hue } from "./modules";

/*
  The workspace kit: the pieces every suite page is assembled from.

  One elevation (`ws-card`), one radius family (18px cards, 12px controls,
  full pills), one blue for action, and a set of hues for telling things apart.
  Pages compose these rather than restyling a div, so a change here is a change
  everywhere — which is the only way ninety pages stay one product.
*/

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/*  Surfaces                                                           */
/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
  as: Tag = "section",
  tour,
}: {
  children: React.ReactNode;
  className?: string;
  as?: "section" | "div" | "article" | "li";
  /** A product-tour anchor (`data-tour`); see `components/tour`. */
  tour?: string;
}) {
  return (
    <Tag className={cx("ws-card", className)} data-tour={tour}>
      {children}
    </Tag>
  );
}

/**
 * The product-tour anchor a titled panel gets for free: "Needs attention"
 * becomes `panel-needs-attention`. Tours point at panels by their title, so a
 * dashboard needs no tour-specific markup, and a panel that is hidden by
 * permission is simply skipped by the tour.
 */
export function panelTourKey(title: React.ReactNode): string | undefined {
  if (typeof title !== "string") return undefined;
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `panel-${slug}` : undefined;
}

/**
 * A card with a title row. The title row is where a card says what it is and
 * offers the one or two things you can do to it.
 */
export function Panel({
  title,
  subtitle,
  icon: Icon,
  hue = "blue",
  actions,
  children,
  className,
  bodyClassName = "p-5",
  tour,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon;
  hue?: Hue;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Overrides the tour anchor derived from the title. */
  tour?: string;
}) {
  return (
    <Card className={cx("flex flex-col overflow-hidden", className)} tour={tour ?? panelTourKey(title)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-3 px-5 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span
                className={cx(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                  HUE[hue].soft,
                )}
              >
                <Icon size={18} aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-[15px] font-semibold text-neutral-900">{title}</h3>
              )}
              {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
            </div>
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Page header                                                        */
/* ------------------------------------------------------------------ */

export interface PageTab {
  key: string;
  label: string;
  href?: string;
  count?: number;
}

/**
 * Title, a line that says what the page is for, the page's actions on the
 * right, and — when a page has sections — underline tabs beneath.
 */
export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  tabs,
  activeTab,
  onTab,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  eyebrow?: React.ReactNode;
  actions?: React.ReactNode;
  tabs?: PageTab[];
  activeTab?: string;
  onTab?: (key: string) => void;
}) {
  return (
    <div className="mb-6" data-tour="page-header">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-primary-600">
              {eyebrow}
            </p>
          )}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">
            {title}
          </h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2" data-tour="page-actions">
            {actions}
          </div>
        )}
      </div>
      {tabs && tabs.length > 0 && (
        <UnderlineTabs tabs={tabs} active={activeTab ?? tabs[0].key} onChange={onTab} className="mt-5" />
      )}
    </div>
  );
}

export function UnderlineTabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: PageTab[];
  active: string;
  onChange?: (key: string) => void;
  className?: string;
}) {
  /*
    A long strip scrolls sideways with its scrollbar hidden, so the overflow
    has to be shown some other way: a fade and a chevron on whichever side has
    more tabs. Without them, a project's last five tabs — Import and Generate
    among them — sat past the edge with nothing saying they existed.
  */
  const strip = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = strip.current;
    if (el === null) return;
    setMore({
      left: el.scrollLeft > 4,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4,
    });
  }, []);

  /*
    The chosen tab is never left half off-screen, or under a chevron. Worked
    out by hand rather than with `scrollIntoView`, and run again whenever the
    strip changes width: the page's scrollbar appears once a tab's content has
    loaded, narrows the strip by its own width, and was leaving the last tab —
    Generate — clipped beneath the right-hand chevron.
  */
  const reveal = useCallback(() => {
    const el = strip.current;
    const tab = el?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (el == null) return;

    if (tab != null) {
      const room = 48;
      const start = tab.offsetLeft - room;
      const end = tab.offsetLeft + tab.offsetWidth + room - el.clientWidth;
      const target = start < el.scrollLeft ? start : end > el.scrollLeft ? end : el.scrollLeft;

      el.scrollLeft = Math.max(0, Math.min(target, el.scrollWidth - el.clientWidth));
    }

    measure();
  }, [measure]);

  useEffect(() => {
    const el = strip.current;
    if (el === null) return;
    reveal();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(reveal);
    observer?.observe(el);
    return () => observer?.disconnect();
  }, [reveal, tabs.length, active]);

  const nudge = (direction: 1 | -1) => {
    const el = strip.current;
    if (el === null) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.7, behavior: "smooth" });
  };

  const edge = (side: "left" | "right") => (
    <div
      aria-hidden
      className={cx(
        "pointer-events-none absolute inset-y-0 z-10 flex items-center transition-opacity duration-200",
        side === "left"
          ? "left-0 bg-gradient-to-r from-canvas via-canvas/90 to-transparent pr-8"
          : "right-0 justify-end bg-gradient-to-l from-canvas via-canvas/90 to-transparent pl-8",
        more[side] ? "opacity-100" : "opacity-0",
      )}
    >
      {/* Pointer-only: keyboard focus already scrolls each tab into view. */}
      <button
        type="button"
        tabIndex={-1}
        onClick={() => nudge(side === "left" ? -1 : 1)}
        className={cx(
          "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-white text-neutral-600 shadow-sm ring-1 ring-neutral-200 transition hover:text-primary-700 hover:ring-primary-200",
          more[side] ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        {side === "left" ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
      </button>
    </div>
  );

  return (
    <div className={cx("relative -mb-px min-w-0 border-b border-neutral-200", className)}>
      {edge("left")}
      <div
        ref={strip}
        role="tablist"
        onScroll={measure}
        /* `relative` makes each tab's offsetLeft measured from the strip itself. */
        className="ws-no-scrollbar relative flex gap-6 overflow-x-auto"
      >
      {tabs.map((t) => {
        const on = t.key === active;
        const cls = cx(
          "relative flex h-11 shrink-0 items-center gap-2 text-sm font-medium transition-colors",
          on ? "text-primary-700" : "text-neutral-500 hover:text-neutral-800",
        );
        const inner = (
          <>
            {t.label}
            {t.count != null && (
              <span
                className={cx(
                  "rounded-full px-1.5 py-0.5 text-[11px] tabular-nums",
                  on ? "bg-primary-100 text-primary-700" : "bg-neutral-100 text-neutral-600",
                )}
              >
                {t.count}
              </span>
            )}
            {on && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-primary-600" />
            )}
          </>
        );
        return t.href ? (
          <Link key={t.key} href={t.href} role="tab" aria-selected={on} className={cls}>
            {inner}
          </Link>
        ) : (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange?.(t.key)}
            className={cls}
          >
            {inner}
          </button>
        );
      })}
      </div>
      {edge("right")}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Buttons                                                            */
/* ------------------------------------------------------------------ */

const BUTTON = {
  primary:
    "bg-primary-600 text-white shadow-sm shadow-primary-600/20 hover:bg-primary-700 focus-visible:ring-primary-300",
  secondary:
    "border border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50 focus-visible:ring-primary-200",
  ghost: "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 focus-visible:ring-primary-200",
  danger: "bg-error-600 text-white hover:bg-error-700 focus-visible:ring-error-400",
} as const;

export type ButtonVariant = keyof typeof BUTTON;

export function buttonClass(variant: ButtonVariant = "secondary", size: "sm" | "md" = "md"): string {
  return cx(
    "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-semibold transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
    size === "sm" ? "h-9 px-3 text-[13px]" : "h-11 px-4 text-sm",
    BUTTON[variant],
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  icon: Icon,
  className,
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: LucideIcon;
}) {
  return (
    <button type="button" className={cx(buttonClass(variant, size), className)} {...rest}>
      {Icon && <Icon size={size === "sm" ? 15 : 17} aria-hidden />}
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "secondary",
  size = "md",
  icon: Icon,
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: "sm" | "md";
  icon?: LucideIcon;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={cx(buttonClass(variant, size), className)}>
      {Icon && <Icon size={size === "sm" ? 15 : 17} aria-hidden />}
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat card                                                          */
/* ------------------------------------------------------------------ */

/**
 * One number worth watching. The icon tile carries the hue, the number
 * carries the weight, and the delta — when there is one — says which way it
 * moved and against what. A figure with no comparison says so rather than
 * inventing one.
 */
export function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  hue = "blue",
  delta,
  deltaLabel,
  hint,
  href,
  featured = false,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: LucideIcon;
  hue?: Hue;
  /** Percentage or absolute change; positive is up. */
  delta?: number | null;
  deltaLabel?: string;
  hint?: React.ReactNode;
  href?: string;
  /** The one card per row painted in the module's colour. */
  featured?: boolean;
}) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  const body = (
    <div
      className={cx(
        "ws-card group flex h-full flex-col gap-4 p-5 transition-shadow",
        href && "hover:shadow-md",
        featured && "!border-transparent bg-gradient-to-br from-primary-600 to-primary-500 text-white",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={cx("text-sm font-medium", featured ? "text-white/85" : "text-neutral-600")}>
          {label}
        </p>
        {Icon && (
          <span
            className={cx(
              "flex h-9 w-9 items-center justify-center rounded-xl",
              featured ? "bg-white/15 text-white" : HUE[hue].soft,
            )}
          >
            <Icon size={18} aria-hidden />
          </span>
        )}
      </div>
      <div>
        <p className="flex items-baseline gap-1.5">
          <span
            className={cx(
              "text-[28px] font-bold leading-none tracking-tight tabular-nums",
              featured ? "text-white" : "text-neutral-900",
            )}
          >
            {value}
          </span>
          {unit && (
            <span className={cx("text-sm font-medium", featured ? "text-white/80" : "text-neutral-500")}>
              {unit}
            </span>
          )}
        </p>
        {(delta != null || deltaLabel || hint) && (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {delta != null && delta !== 0 && (
              <span
                className={cx(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums",
                  featured
                    ? "bg-white/15 text-white"
                    : up
                      ? "bg-mint-50 text-mint-700"
                      : "bg-coral-50 text-coral-700",
                )}
              >
                {up ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
                {Math.abs(delta)}%
                <span className="sr-only">{up ? "up" : down ? "down" : ""}</span>
              </span>
            )}
            {deltaLabel && (
              <span className={featured ? "text-white/80" : "text-neutral-500"}>{deltaLabel}</span>
            )}
            {hint && <span className={featured ? "text-white/80" : "text-neutral-500"}>{hint}</span>}
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

/** A row of stat cards that reflows from one column to four. */
export function StatGrid({ children, cols = 4 }: { children: React.ReactNode; cols?: 2 | 3 | 4 | 5 }) {
  const grid = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 xl:grid-cols-4",
    5: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5",
  }[cols];
  return (
    <div className={cx("grid grid-cols-1 gap-4", grid)} data-tour="stats">
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Chips                                                              */
/* ------------------------------------------------------------------ */

/**
 * A coloured label. Colour tells things apart; the words say what they are —
 * a chip is never colour alone.
 */
export function Chip({
  hue = "slate",
  dot = false,
  icon: Icon,
  children,
  className,
}: {
  hue?: Hue;
  dot?: boolean;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold",
        HUE[hue].soft,
        className,
      )}
    >
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", HUE[hue].dot)} aria-hidden />}
      {Icon && <Icon size={12} aria-hidden />}
      {children}
    </span>
  );
}

/** Priority, the way the board references mark it: a word on its own wash. */
export function PriorityChip({ priority }: { priority: string | null | undefined }) {
  const p = (priority ?? "").toLowerCase();
  const hue: Hue =
    p === "urgent" || p === "critical" || p === "highest"
      ? "rose"
      : p === "high"
        ? "coral"
        : p === "medium" || p === "normal"
          ? "sun"
          : p === "low" || p === "lowest"
            ? "sky"
            : "slate";
  return <Chip hue={hue}>{priority ? priority[0].toUpperCase() + priority.slice(1) : "No priority"}</Chip>;
}

/* ------------------------------------------------------------------ */
/*  People                                                             */
/* ------------------------------------------------------------------ */

export function initialsOf(name: string | null | undefined): string {
  return (
    (name ?? "")
      .replace(/^(dr|mr|mrs|ms|prof)\.?\s+/i, "")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join("") || "?"
  );
}

const AVATAR_BG: Record<Hue, string> = {
  blue: "bg-primary-100 text-primary-700",
  coral: "bg-coral-100 text-coral-700",
  mint: "bg-mint-100 text-mint-700",
  grape: "bg-grape-100 text-grape-700",
  sun: "bg-sun-100 text-sun-700",
  sky: "bg-sky-100 text-sky-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-neutral-200 text-neutral-700",
};

export function PersonAvatar({
  name,
  src,
  size = 32,
  ring = false,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
  ring?: boolean;
}) {
  const style = { width: size, height: size, fontSize: Math.max(10, size * 0.38) };
  const ringCls = ring ? "ring-2 ring-white" : "";
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? ""}
        style={style}
        className={cx("shrink-0 rounded-full object-cover", ringCls)}
      />
    );
  }
  return (
    <span
      title={name ?? undefined}
      style={style}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        AVATAR_BG[hueFor(name)],
        ringCls,
      )}
    >
      <span aria-hidden>{initialsOf(name)}</span>
      <span className="sr-only">{name}</span>
    </span>
  );
}

/** Overlapping avatars with a "+n" for the rest. */
export function AvatarStack({
  people,
  max = 4,
  size = 28,
}: {
  people: { name: string | null; src?: string | null }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  /*
    Overlap scales with the avatar. A fixed 8px was fine at 32px and hid most
    of a two-letter monogram at 24px, so a card's stack read "Zl", "Y/".
  */
  const overlap = -Math.round(size * 0.22);
  return (
    <div className="flex items-center">
      {shown.map((p, i) => (
        <span key={`${p.name}-${i}`} className="inline-flex" style={i === 0 ? undefined : { marginLeft: overlap }}>
          <PersonAvatar name={p.name} src={p.src} size={size} ring />
        </span>
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, marginLeft: overlap }}
          className="inline-flex items-center justify-center rounded-full bg-neutral-900 text-[11px] font-semibold text-white ring-2 ring-white"
        >
          +{rest}
        </span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Progress                                                           */
/* ------------------------------------------------------------------ */

/**
 * Progress as a bar whose unfilled part is hatched, the workspace's signature
 * texture: remaining work reads as "not yet", not as an empty grey trough.
 */
export function Progress({
  value,
  hue = "blue",
  label,
  showValue = false,
  size = "md",
}: {
  value: number;
  hue?: Hue;
  label?: string;
  showValue?: boolean;
  size?: "sm" | "md";
}) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="w-full">
      {(label || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-xs">
          {label && <span className="text-neutral-600">{label}</span>}
          {showValue && <span className="font-semibold tabular-nums text-neutral-900">{pct}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cx("ws-hatch overflow-hidden rounded-full", size === "sm" ? "h-1.5" : "h-2.5")}
      >
        <div
          className={cx("h-full rounded-full transition-[width] duration-500", HUE[hue].bar)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Toolbar                                                            */
/* ------------------------------------------------------------------ */

/** The row above a list: search on the left, filters and views on the right. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cx("mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      {children}
    </div>
  );
}

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  className,
  label = "Search",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
}) {
  return (
    <label className={cx("relative block", className)} data-tour="search">
      <span className="sr-only">{label}</span>
      <svg
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-neutral-200 bg-white pl-10 pr-3 text-sm text-neutral-800 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
      />
    </label>
  );
}

/** A small segmented control: Weekly / Monthly, Today / Tomorrow. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { key: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-neutral-100 p-1" data-tour="segmented">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.key)}
            className={cx(
              "h-8 cursor-pointer rounded-lg px-3 text-[13px] font-semibold transition",
              on ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500 hover:text-neutral-800",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Empty                                                              */
/* ------------------------------------------------------------------ */

export function Empty({
  icon: Icon,
  title,
  hint,
  action,
  hue = "blue",
}: {
  icon: LucideIcon;
  title: string;
  hint?: string;
  action?: React.ReactNode;
  hue?: Hue;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <span className={cx("flex h-14 w-14 items-center justify-center rounded-2xl", HUE[hue].soft)}>
        <Icon size={24} aria-hidden />
      </span>
      <div>
        <p className="text-[15px] font-semibold text-neutral-900">{title}</p>
        {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">{hint}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
