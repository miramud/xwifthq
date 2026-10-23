"use client";

import Link from "next/link";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import type { Tone } from "@/components/dashboard/ui";
import { Card, Chip, Empty, cx, initialsOf } from "@/components/workspace/kit";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";

/*
  HR-specific glue between the module's existing vocabulary and the workspace
  kit. The status tones in `suite/hrm/lib/format` stay the single source of
  what colour a state is; this file only says which workspace hue each tone
  wears, so a status is the same chip on the dashboard, the directory and the
  person's own record.
*/

const TONE_HUE: Record<Tone, Hue> = {
  primary: "blue",
  success: "mint",
  warning: "sun",
  error: "coral",
  info: "sky",
  accent: "grape",
  neutral: "slate",
};

export function toneHue(tone: Tone): Hue {
  return TONE_HUE[tone];
}

/** A status chip from a module tone. Always carries its words. */
export function ToneChip({
  tone,
  children,
  dot = true,
  icon,
}: {
  tone: Tone;
  children: React.ReactNode;
  dot?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <Chip hue={TONE_HUE[tone]} dot={dot && !icon} icon={icon}>
      {children}
    </Chip>
  );
}

/** Avatar, name and a quiet second line — the first cell of most HR tables. */
export function PersonCell({
  name,
  sub,
  src,
  href,
  size = 36,
}: {
  name: string | null | undefined;
  sub?: React.ReactNode;
  src?: string | null;
  href?: string;
  size?: number;
}) {
  const label = name ?? "Unnamed";
  return (
    <span className="flex min-w-0 items-center gap-3">
      <InitialsAvatar name={label} src={src} size={size} />
      <span className="min-w-0">
        {href ? (
          <Link
            href={href}
            className="block truncate text-sm font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:underline"
          >
            {label}
          </Link>
        ) : (
          <span className="block truncate text-sm font-semibold text-neutral-900">{label}</span>
        )}
        {sub && <span className="block truncate text-xs text-neutral-500">{sub}</span>}
      </span>
    </span>
  );
}

/** An icon tile in a hue — the same tile the kit's Panel and StatCard use. */
export function IconTile({
  icon: Icon,
  hue = "blue",
  size = 36,
  className,
}: {
  icon: LucideIcon;
  hue?: Hue;
  size?: number;
  className?: string;
}) {
  return (
    <span
      style={{ width: size, height: size }}
      className={cx("flex shrink-0 items-center justify-center rounded-xl", HUE[hue].soft, className)}
    >
      <Icon size={Math.round(size * 0.5)} aria-hidden />
    </span>
  );
}

/** One fact on a detail page: icon, label, value. */
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
    <div className="flex items-start gap-3 py-2.5">
      <IconTile icon={Icon} hue={hue} size={32} />
      <div className="min-w-0 flex-1">
        <dt className="text-xs font-medium text-neutral-500">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium text-neutral-900">{children}</dd>
      </div>
    </div>
  );
}

/** "That did not load", in a card. */
export function LoadError({ message, title = "That did not load" }: { message: string; title?: string }) {
  return (
    <Card>
      <Empty icon={AlertTriangle} hue="coral" title={title} hint={message} />
    </Card>
  );
}

/** Skeleton blocks while a page's first request is in flight. */
export function LoadingBlocks({ count = 4, className = "h-28" }: { count?: number; className?: string }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={cx("ws-card animate-pulse bg-neutral-50", className)} />
      ))}
    </div>
  );
}

/** A small labelled figure inside a card: "3 · Due this week". */
export function MiniFact({
  label,
  value,
  hue = "slate",
}: {
  label: string;
  value: React.ReactNode;
  hue?: Hue;
}) {
  return (
    <div className={cx("rounded-xl px-3 py-2", HUE[hue].soft)}>
      <p className="text-[11px] font-medium opacity-80">{label}</p>
      <p className="text-sm font-bold tabular-nums">{value}</p>
    </div>
  );
}

/**
 * The featured stat card (Finora's painted card), drawn here without the
 * `ws-card` class: that class sets `background` in unlayered CSS, which
 * overrides the kit StatCard's gradient and leaves its white text on white.
 * Same props as the kit's StatCard for the parts a featured card uses.
 */
export function FeaturedStat({
  label,
  value,
  unit,
  icon: Icon,
  hint,
  href,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  icon?: LucideIcon;
  hint?: React.ReactNode;
  href?: string;
}) {
  const body = (
    <div className="relative flex h-full flex-col gap-4 overflow-hidden rounded-[1.125rem] bg-gradient-to-br from-primary-600 via-primary-600 to-sky-500 p-5 text-white shadow-lg shadow-primary-600/20">
      <span className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/10" aria-hidden />
      <span className="pointer-events-none absolute -bottom-12 right-10 h-24 w-24 rounded-full bg-white/10" aria-hidden />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-white/85">{label}</p>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
            <Icon size={18} aria-hidden />
          </span>
        )}
      </div>
      <div className="relative">
        <p className="flex items-baseline gap-1.5">
          <span className="text-[28px] font-bold leading-none tracking-tight tabular-nums">{value}</span>
          {unit && <span className="text-sm font-medium text-white/80">{unit}</span>}
        </p>
        {hint && <p className="mt-2 text-xs text-white/85">{hint}</p>}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-[1.125rem] outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
      {body}
    </Link>
  ) : (
    body
  );
}

const INITIALS_BG: Record<Hue, string> = {
  blue: "bg-primary-100 text-primary-700",
  coral: "bg-coral-100 text-coral-700",
  mint: "bg-mint-100 text-mint-700",
  grape: "bg-grape-100 text-grape-700",
  sun: "bg-sun-100 text-sun-700",
  sky: "bg-sky-100 text-sky-700",
  rose: "bg-rose-100 text-rose-700",
  slate: "bg-neutral-200 text-neutral-700",
};

/**
 * Initials in the person's colour, hidden from assistive technology — for
 * places where the name is already written beside it, so a screen reader does
 * not read it twice (the kit's PersonAvatar carries its own sr-only name).
 */
export function InitialsAvatar({
  name,
  src,
  size = 36,
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: number;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" style={{ width: size, height: size }} className="shrink-0 rounded-full object-cover" />
    );
  }
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      className={cx(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold",
        INITIALS_BG[hueFor(name)],
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
