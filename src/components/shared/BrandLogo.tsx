/**
 * The XwiftHQ mark and lockup.
 *
 * An "X" woven from two strokes on a rounded purple tile: one stroke runs
 * straight through, the other passes underneath it, so the letter reads as
 * two streams of work meeting in one place. Drawn in JSX so it recolours per
 * surface and stays crisp at 16px.
 *
 * Three surfaces:
 *
 *   colour    purple tile lit by a lighter violet gradient from its top
 *             left corner, white and lilac strokes, wherever colour allows
 *   reversed  white tile, purple strokes, on purple or ink grounds
 *   mono      strokes only, in currentColor, for one colour printing
 */

import { useId } from "react";

export type MarkVariant = "colour" | "reversed" | "mono";

const TILE: Record<MarkVariant, string | null> = {
  colour: "#9638CD",
  reversed: "#FFFFFF",
  mono: null,
};

const FRONT: Record<MarkVariant, string> = {
  colour: "#FFFFFF",
  reversed: "#9638CD",
  mono: "currentColor",
};

const BACK: Record<MarkVariant, string> = {
  colour: "#E2C6F7",
  reversed: "#BC7EE6",
  mono: "currentColor",
};

export function XwiftMark({
  variant = "colour",
  className = "h-8 w-8",
  title,
}: {
  variant?: MarkVariant;
  className?: string;
  /** Omit inside a lockup that already names the brand, or it is read twice. */
  title?: string;
}) {
  const tile = TILE[variant];
  // The sheen needs an id unique to this instance: two marks on one page
  // sharing a gradient id would both paint from whichever rendered first.
  const sheen = `xw-sheen-${useId().replace(/:/g, "")}`;

  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {tile && <rect width="40" height="40" rx="11" fill={tile} data-part="tile" />}
      {variant === "colour" && (
        <>
          <defs>
            <linearGradient id={sheen} x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor="#D4AEF2" stopOpacity="0.85" />
              <stop offset="0.55" stopColor="#BC7EE6" stopOpacity="0.25" />
              <stop offset="1" stopColor="#9638CD" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="11" fill={`url(#${sheen})`} />
        </>
      )}
      <g strokeWidth="5" strokeLinecap="round">
        <path d="M30 10L25 15" stroke={BACK[variant]} data-part="back" />
        <path d="M15 25L10 30" stroke={BACK[variant]} data-part="back" />
        <path d="M11 11L29 29" stroke={FRONT[variant]} data-part="front" />
      </g>
    </svg>
  );
}

/**
 * Mark plus wordmark. `markClassName` sizes the mark; the word scales with the
 * surrounding type so a lockup in a sidebar and one in a hero stay in
 * proportion without a size prop for every context.
 */
export function XwiftLockup({
  variant = "colour",
  className = "",
  markClassName = "h-8 w-8",
  wordClassName = "text-xl",
}: {
  variant?: MarkVariant;
  className?: string;
  markClassName?: string;
  wordClassName?: string;
}) {
  const word =
    variant === "reversed" ? "text-white" : variant === "mono" ? "text-current" : "text-neutral-900";

  const hq =
    variant === "reversed" ? "text-primary-200" : variant === "mono" ? "text-current" : "text-primary-600";

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <XwiftMark variant={variant} className={markClassName} />
      <span className={`font-heading font-bold tracking-[-0.03em] leading-none ${word} ${wordClassName}`}>
        Xwift<span className={hq}>HQ</span>
      </span>
    </span>
  );
}
