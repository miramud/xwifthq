"use client";

import { X } from "lucide-react";
import { cx, initialsOf } from "@/components/workspace/kit";
import { HUE, hueFor, type Hue } from "@/components/workspace/modules";

/*
  Pieces the organisation console needs on more than one screen and the
  workspace kit does not carry: an institution's mark, a seat meter, and the
  modal chrome its dialogs share. Built from kit tokens only.
*/

/** An institution's logo, or its initials on a stable hue, in a rounded square. */
export function OrgMark({
  name,
  logoUrl,
  size = 40,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  const style = { width: size, height: size };
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary host, no loader configured
      <img
        src={logoUrl}
        alt=""
        style={style}
        className="shrink-0 rounded-xl border border-neutral-200 bg-white object-contain p-1"
      />
    );
  }
  return (
    <span
      style={{ ...style, fontSize: Math.max(11, size * 0.36) }}
      className={cx("flex shrink-0 items-center justify-center rounded-xl font-bold", HUE[hueFor(name)].tile)}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  );
}

/**
 * Seats are the commercial constraint, so they get a meter rather than a
 * number: 198/200 has to read as "nearly full" without arithmetic. Colour is
 * backed by the printed ratio, never carrying the meaning alone. The unfilled
 * part is hatched, the workspace's "not yet" texture.
 */
export function SeatMeter({
  used,
  limit,
  className = "w-36",
}: {
  used: number;
  limit: number | null;
  className?: string;
}) {
  if (limit === null) {
    return (
      <div className="text-right">
        <p className="text-sm font-semibold tabular-nums text-neutral-900">{used}</p>
        <p className="text-xs text-neutral-500">seats used</p>
      </div>
    );
  }

  const percent = Math.min(100, Math.round((used / limit) * 100));
  const hue: Hue = percent >= 100 ? "rose" : percent >= 85 ? "sun" : "blue";

  return (
    <div className={className}>
      <p className="flex items-baseline justify-between gap-2 text-sm font-semibold tabular-nums text-neutral-900">
        <span>
          {used}
          <span className="font-medium text-neutral-500"> / {limit}</span>
        </span>
        <span className="text-xs font-medium text-neutral-500">{percent}%</span>
      </p>
      <div
        className="ws-hatch mt-1.5 h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={used}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`${used} of ${limit} seats used`}
      >
        <div className={cx("h-full rounded-full", HUE[hue].bar)} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/**
 * The chrome of a workspace dialog: a scrim that closes it, a white 18px
 * sheet (bottom sheet on a phone), a title row with a close button, a
 * scrolling body and a footer. The caller owns the element and its role —
 * pass `as="form"` with `onSubmit` for a dialog that submits.
 */
export function DialogFrame({
  titleId,
  title,
  subtitle,
  onClose,
  children,
  footer,
  as = "div",
  onSubmit,
  size = "md",
}: {
  titleId: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  as?: "div" | "form";
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  size?: "md" | "lg";
}) {
  const sheet = cx(
    "relative mt-auto flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-[1.125rem] bg-white shadow-2xl sm:mb-auto sm:rounded-[1.125rem]",
    size === "lg" ? "max-w-2xl" : "max-w-lg",
  );
  const inner = (
    <>
      <div className="flex items-start justify-between gap-4 px-6 pb-4 pt-6">
        <div className="min-w-0">
          <h2 id={titleId} className="text-lg font-bold tracking-tight text-neutral-900">
            {title}
          </h2>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-m-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none hover:bg-neutral-100 hover:text-neutral-800 focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-6">{children}</div>
      {footer && <div className="border-t border-neutral-100 bg-neutral-50/60 px-6 py-4">{footer}</div>}
    </>
  );

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto overscroll-contain p-0 sm:p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 cursor-default bg-neutral-900/40 backdrop-blur-sm"
      />
      {as === "form" ? (
        <form onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby={titleId} className={sheet}>
          {inner}
        </form>
      ) : (
        <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={sheet}>
          {inner}
        </div>
      )}
    </div>
  );
}
