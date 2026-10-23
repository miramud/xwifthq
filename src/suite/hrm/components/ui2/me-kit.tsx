"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cx, initialsOf } from "@/components/workspace/kit";
import { hueFor, type Hue } from "@/components/workspace/modules";

/*
  Small pieces the self-service (/suite/hrm/me/*) pages share.
*/

const DECOR_BG: Record<Hue, string> = {
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
 * Initials in a coloured circle, hidden from assistive tech — for when the
 * name is printed right beside it, so a screen reader does not read it twice.
 */
export function DecorAvatar({ name, size = 32 }: { name: string | null | undefined; size?: number }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.38) }}
      className={cx("inline-flex shrink-0 items-center justify-center rounded-full font-semibold", DECOR_BG[hueFor(name)])}
    >
      {initialsOf(name)}
    </span>
  );
}

/** "Back to my employment" — the self-service pages' way home. */
export function MeBack() {
  return (
    <Link
      href="/suite/hrm/me"
      className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary-600 hover:text-primary-700"
    >
      My employment <ChevronRight size={13} aria-hidden />
    </Link>
  );
}

/** A heading for a DataView that sits on the canvas rather than in a Panel. */
export function SectionHead({
  id,
  title,
  subtitle,
  actions,
}: {
  id?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id} className="text-[17px] font-bold tracking-tight text-neutral-900">
          {title}
        </h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-neutral-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
