"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Briefcase,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FolderKanban,
  Landmark,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { HUE, hueFor, type Hue } from "./modules";

/*
  The workspace kit: the pieces every suite page is assembled from.

  One elevation (`ws-card`), one radius family (18px cards, 12px controls,
  full pills), one blue for action, and a set of hues for telling things apart.
  Pages compose these rather than restyling a div, so a change here is a change
  everywhere, which is the only way ninety pages stay one product.
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
        <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-5">
          <div className="flex min-w-0 items-center gap-3">
            {Icon && (
              <span
                className={cx(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
                  HUE[hue].soft,
                )}
              >
                <Icon size={18} aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              {title && (
                <h3 className="truncate text-base font-bold tracking-tight text-neutral-900">{title}</h3>
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
 * right, and, when a page has sections, underline tabs beneath.
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
    more tabs. Without them, a project's last five tabs, Import and Generate
    among them, sat past the edge with nothing saying they existed.
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
    loaded, narrows the strip by its own width, and was leaving the last tab, 
    Generate, clipped beneath the right-hand chevron.
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
    "bg-primary-600 bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-md shadow-primary-600/25 hover:from-primary-700 hover:to-primary-600 focus-visible:ring-primary-300",
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
 * The round, saturated icon that leads a stat card: a gradient disc in the
 * hue, white glyph, a soft glow of the same colour beneath it.
 */
const ORB: Record<Hue, string> = {
  blue: "from-primary-400 to-primary-600 shadow-primary-500/30 text-white",
  coral: "from-coral-400 to-coral-600 shadow-coral-500/30 text-white",
  mint: "from-mint-400 to-mint-600 shadow-mint-500/30 text-white",
  grape: "from-grape-400 to-grape-600 shadow-grape-500/30 text-white",
  sun: "from-sun-300 to-sun-500 shadow-sun-500/30 text-neutral-900",
  sky: "from-sky-400 to-sky-600 shadow-sky-500/30 text-white",
  rose: "from-rose-400 to-rose-600 shadow-rose-500/30 text-white",
  slate: "from-neutral-500 to-neutral-700 shadow-neutral-500/25 text-white",
};

/** The round gradient icon of a stat card, for cards built outside the kit. */
export function orbClass(hue: Hue): string {
  return cx("bg-gradient-to-br shadow-lg", ORB[hue]);
}

/** The whole card painted in a hue, for the one figure per row that leads. */
const FEATURED: Record<Hue, string> = {
  blue: "from-primary-700 via-primary-600 to-primary-500 text-white shadow-primary-600/25",
  coral: "from-coral-700 via-coral-600 to-coral-500 text-white shadow-coral-500/25",
  mint: "from-mint-700 via-mint-600 to-mint-500 text-white shadow-mint-500/25",
  grape: "from-grape-700 via-grape-600 to-grape-500 text-white shadow-grape-500/25",
  sun: "from-sun-500 via-sun-400 to-sun-300 text-neutral-900 shadow-sun-500/25",
  sky: "from-sky-700 via-sky-600 to-sky-500 text-white shadow-sky-500/25",
  rose: "from-rose-700 via-rose-600 to-rose-500 text-white shadow-rose-500/25",
  slate: "from-neutral-900 via-neutral-800 to-neutral-700 text-white shadow-neutral-900/20",
};

/**
 * One number worth watching, the way the references set their KPI row: a
 * round gradient icon on the left, the label above the figure, and the delta,
 * when there is one, as a green or red pill with what it is measured against.
 * A figure with no comparison says so rather than inventing one.
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
  featuredHue = "blue",
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
  /** The one card per row painted in colour. */
  featured?: boolean;
  /** The colour a featured card is painted in; the brand purple by default. */
  featuredHue?: Hue;
}) {
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  const onColour = featured;
  const body = (
    <div
      className={cx(
        "ws-card group relative flex h-full items-center gap-4 overflow-hidden p-5 transition-[box-shadow,transform] duration-200",
        href && "hover:-translate-y-0.5 hover:shadow-lg motion-reduce:hover:translate-y-0",
        featured && cx("!border-transparent bg-gradient-to-br shadow-lg", FEATURED[featuredHue]),
      )}
    >
      {featured && (
        <>
          <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" aria-hidden />
          <span className="pointer-events-none absolute -bottom-12 right-10 h-24 w-24 rounded-full bg-white/10" aria-hidden />
        </>
      )}
      {Icon && (
        <span
          className={cx(
            "relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full",
            featured ? "bg-white/20 text-current ring-1 ring-white/25" : cx("bg-gradient-to-br shadow-lg", ORB[hue]),
          )}
        >
          <Icon size={24} aria-hidden />
        </span>
      )}
      <div className="relative min-w-0 flex-1">
        <p className={cx("truncate text-[13px] font-medium", onColour ? "opacity-90" : "text-neutral-500")}>{label}</p>
        <p className="mt-1 flex items-baseline gap-1.5">
          <span
            className={cx(
              "truncate text-[26px] font-bold leading-tight tracking-tight tabular-nums",
              onColour ? "text-current" : "text-neutral-900",
            )}
          >
            {value}
          </span>
          {unit && <span className={cx("text-sm font-medium", onColour ? "opacity-80" : "text-neutral-500")}>{unit}</span>}
        </p>
        {(delta != null || deltaLabel || hint) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            {delta != null && delta !== 0 && (
              <span
                className={cx(
                  "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-semibold tabular-nums",
                  onColour ? "bg-white/20" : up ? "bg-mint-50 text-mint-700" : "bg-coral-50 text-coral-700",
                )}
              >
                {up ? <ArrowUpRight size={12} aria-hidden /> : <ArrowDownRight size={12} aria-hidden />}
                {Math.abs(delta)}%
                <span className="sr-only">{up ? "up" : down ? "down" : ""}</span>
              </span>
            )}
            {deltaLabel && <span className={onColour ? "opacity-85" : "text-neutral-500"}>{deltaLabel}</span>}
            {hint && <span className={cx("min-w-0", onColour ? "opacity-85" : "text-neutral-500")}>{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[1.25rem] outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
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
 * A coloured label. Colour tells things apart; the words say what they are, 
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

/** The fill of a progress bar: a gradient that brightens towards its end. */
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
 * Progress as a rounded gradient bar on a soft lilac track, the way the
 * references draw project and budget progress.
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
          className={cx("h-full rounded-full bg-gradient-to-r transition-[width] duration-500", HUE[hue].bar, BAR_FILL[hue])}
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

/* ------------------------------------------------------------------ */
/*  Landing-page pieces                                                */
/* ------------------------------------------------------------------ */

/** "Good morning" and friends, from the hour of the day. */
export function greetingFor(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const noSubscribe = () => () => undefined;

/**
 * The greeting for the viewer's own clock. The server cannot know it, so the
 * server and the first client render say "Welcome back" and the time of day
 * arrives straight after hydration, with no mismatch.
 */
export function useGreeting(): string {
  return useSyncExternalStore(
    noSubscribe,
    () => greetingFor(new Date().getHours()),
    () => "Welcome back",
  );
}

/** First name for a greeting: "Dr Amaka Obi" greets as "Amaka". */
export function firstNameOf(name: string | null | undefined): string | null {
  const parts = (name ?? "")
    .replace(/^(dr|mr|mrs|ms|miss|prof)\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return parts[0] ?? null;
}

const BANNER_ART = {
  money: [Wallet, Landmark, BarChart3],
  people: [Users, CalendarCheck, Briefcase],
  projects: [FolderKanban, ClipboardCheck, CalendarCheck],
  learning: [BookOpen, Sparkles, ClipboardCheck],
  operations: [Wrench, ClipboardCheck, Briefcase],
  organisation: [ShieldCheck, Users, Landmark],
  chart: [BarChart3, Sparkles, ShieldCheck],
} satisfies Record<string, [LucideIcon, LucideIcon, LucideIcon]>;

export type BannerArt = keyof typeof BANNER_ART;

/** A button that sits on the banner's purple: solid white, or frosted glass. */
export function bannerButtonClass(kind: "solid" | "glass" = "solid"): string {
  return cx(
    "inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-white/70",
    kind === "solid"
      ? "bg-white text-primary-700 shadow-md shadow-primary-900/20 hover:bg-primary-50"
      : "bg-white/15 text-white ring-1 ring-inset ring-white/30 hover:bg-white/25",
  );
}

/**
 * The landing page's greeting hero: a deep purple card that says hello by
 * name, one line on what the page is for, the headline figure when there is
 * one, and the page's main actions, with a small illustration of floating
 * tiles on the right. It carries the page's heading and the `page-header`
 * tour anchor, so it stands in for `PageHeader` on a module's front page.
 */
export function WelcomeBanner({
  name,
  title,
  eyebrow,
  subtitle,
  figure,
  actions,
  aside,
  art = "chart",
  headingLevel = 1,
  className,
}: {
  /** The viewer's name; the banner greets them by first name. */
  name?: string | null;
  /** Replaces the greeting line entirely. */
  title?: React.ReactNode;
  eyebrow?: React.ReactNode;
  subtitle?: React.ReactNode;
  /** The one figure the page leads with. */
  figure?: { label: React.ReactNode; value: React.ReactNode; hint?: React.ReactNode };
  /** Buttons; build them with `bannerButtonClass`. */
  actions?: React.ReactNode;
  /** Replaces the illustration (a small stat, a chip list). */
  aside?: React.ReactNode;
  art?: BannerArt;
  headingLevel?: 1 | 2;
  className?: string;
}) {
  const greeting = useGreeting();
  const first = firstNameOf(name);
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const [A, B, C] = BANNER_ART[art];

  return (
    <section
      data-tour="page-header"
      className={cx(
        "relative mb-6 overflow-hidden rounded-[1.5rem] bg-gradient-to-br from-primary-800 via-primary-700 to-primary-500 p-6 text-white shadow-xl shadow-primary-700/20 sm:p-8",
        className,
      )}
    >
      {/* Soft light and lines behind the content. Decorative. */}
      <span className="pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <span className="pointer-events-none absolute -bottom-28 right-1/4 h-72 w-72 rounded-full bg-primary-300/25 blur-3xl" aria-hidden />
      <svg
        className="pointer-events-none absolute inset-y-0 right-0 hidden h-full w-1/2 opacity-[0.14] md:block"
        viewBox="0 0 400 200"
        preserveAspectRatio="none"
        aria-hidden
      >
        <path d="M0 160 C 80 120, 140 190, 220 130 S 340 60, 400 90" fill="none" stroke="white" strokeWidth="2" />
        <path d="M0 185 C 90 150, 160 200, 240 160 S 350 110, 400 130" fill="none" stroke="white" strokeWidth="1.5" />
      </svg>

      <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 max-w-2xl">
          {eyebrow && <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-white/75">{eyebrow}</p>}
          <Heading className="text-2xl font-bold tracking-tight sm:text-[30px] sm:leading-tight">
            {title ?? (first ? `${greeting}, ${first}` : greeting)}
          </Heading>
          {subtitle && <p className="mt-2 max-w-xl text-sm leading-relaxed text-white/85">{subtitle}</p>}

          {figure && (
            <div className="mt-5">
              <p className="text-xs font-medium text-white/75">{figure.label}</p>
              <p className="mt-1 text-[34px] font-bold leading-none tracking-tight tabular-nums">{figure.value}</p>
              {figure.hint && <p className="mt-2 text-xs text-white/80">{figure.hint}</p>}
            </div>
          )}

          {actions && (
            <div className="mt-6 flex flex-wrap items-center gap-2.5" data-tour="page-actions">
              {actions}
            </div>
          )}
        </div>

        {aside ? (
          <div className="relative shrink-0">{aside}</div>
        ) : (
          <div className="relative hidden h-40 w-64 shrink-0 lg:block" aria-hidden>
            <span className="absolute right-6 top-0 flex h-20 w-20 rotate-6 items-center justify-center rounded-3xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <A size={34} />
            </span>
            <span className="absolute bottom-2 right-0 flex h-16 w-16 -rotate-6 items-center justify-center rounded-2xl bg-white text-primary-700 shadow-xl shadow-primary-900/30">
              <B size={28} />
            </span>
            <span className="absolute bottom-6 left-6 flex h-14 w-14 -rotate-3 items-center justify-center rounded-2xl bg-sun-300 text-neutral-900 shadow-lg shadow-primary-900/30">
              <C size={24} />
            </span>
            <span className="absolute left-20 top-6 h-3 w-3 rounded-full bg-white/60" />
            <span className="absolute bottom-0 left-28 h-2 w-2 rounded-full bg-sun-300" />
          </div>
        )}
      </div>
    </section>
  );
}

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  hue?: Hue;
}

/**
 * Shortcuts as tinted tiles with the name underneath: the "Quick links" strip
 * of the references. Pass only the links the viewer may open; an empty list
 * renders nothing.
 */
export function QuickActions({
  items,
  title = "Quick links",
  className,
}: {
  items: QuickAction[];
  title?: string | null;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <nav aria-label={title ?? "Shortcuts"} className={cx("ws-card p-5", className)} data-tour="quick-actions">
      {title && <h2 className="mb-4 text-base font-bold tracking-tight text-neutral-900">{title}</h2>}
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className="group flex h-full min-h-[96px] flex-col items-center justify-center gap-2.5 rounded-2xl border border-neutral-100 bg-white px-2 py-3 text-center outline-none transition hover:-translate-y-0.5 hover:border-primary-200 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300 motion-reduce:hover:translate-y-0"
              >
                <span className={cx("flex h-12 w-12 items-center justify-center rounded-2xl transition group-hover:scale-105", HUE[it.hue ?? "blue"].soft)}>
                  <Icon size={22} aria-hidden />
                </span>
                <span className="text-xs font-semibold leading-tight text-neutral-700">{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** "View all" in a panel's header: a short link with an arrow. */
export function ViewAllLink({
  href,
  children = "View all",
  className,
}: {
  href: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "inline-flex min-h-11 items-center gap-1 rounded-lg px-1 text-[13px] font-semibold text-primary-700 outline-none transition hover:text-primary-800 focus-visible:ring-2 focus-visible:ring-primary-300",
        className,
      )}
    >
      {children}
      <ArrowRight size={14} aria-hidden />
    </Link>
  );
}

/**
 * A tinted note strip inside a card: an icon tile, a bold line and a quieter
 * one, and a chevron when it leads somewhere ("You are on track", "Income is
 * up on last month").
 */
export function CalloutStrip({
  icon: Icon,
  hue = "blue",
  title,
  children,
  href,
  className,
}: {
  icon: LucideIcon;
  hue?: Hue;
  title: React.ReactNode;
  children?: React.ReactNode;
  href?: string;
  className?: string;
}) {
  const inner = (
    <>
      <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm", HUE[hue].text)}>
        <Icon size={18} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-neutral-900">{title}</span>
        {children && <span className="mt-0.5 block text-xs text-neutral-600">{children}</span>}
      </span>
      {href && <ChevronRight size={18} className={cx("shrink-0", HUE[hue].text)} aria-hidden />}
    </>
  );
  const cls = cx("flex items-center gap-3 rounded-2xl px-4 py-3", HUE[hue].soft, className);
  return href ? (
    <Link href={href} className={cx(cls, "outline-none transition hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-primary-300")}>
      {inner}
    </Link>
  ) : (
    <div className={cls}>{inner}</div>
  );
}
