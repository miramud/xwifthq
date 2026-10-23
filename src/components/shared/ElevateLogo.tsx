/**
 * The Elevate mark and lockup.
 *
 * Three rising columns for the stages of learning, and a gold cap for the
 * moment of mastery. Geometry is taken verbatim from `Elevate Logo Mark.svg`
 * at the repo root — this is a redraw of the asset in JSX so it can be
 * recoloured per surface and stay crisp at 16px, not a new interpretation of
 * it.
 *
 * Four surfaces, exactly as the brand guide sets them out:
 *
 *   colour    teal columns, gold cap — wherever colour allows
 *   reversed  white columns, gold cap — on teal
 *   gold      gold columns, white cap — on ink
 *   mono      single colour — one-colour printing, watermarks
 *
 * The wordmark's full stop is gold in every variant but `mono`. It is the one
 * flourish the brand has; it does not get a second one.
 */

export type MarkVariant = "colour" | "reversed" | "gold" | "mono";

const COLUMN_FILL: Record<MarkVariant, string> = {
  colour: "#0C4F54",
  reversed: "#FFFFFF",
  gold: "#E6A532",
  mono: "currentColor",
};

const CAP_FILL: Record<MarkVariant, string> = {
  colour: "#E6A532",
  reversed: "#E6A532",
  gold: "#FFFFFF",
  mono: "currentColor",
};

export function ElevateMark({
  variant = "colour",
  className = "h-8 w-8",
  title,
}: {
  variant?: MarkVariant;
  className?: string;
  /** Omit inside a lockup that already names the brand, or it is read twice. */
  title?: string;
}) {
  const columns = COLUMN_FILL[variant];
  const cap = CAP_FILL[variant];

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect x="14" y="38" width="9" height="14" rx="3.5" fill={columns} />
      <rect x="28" y="29" width="9" height="23" rx="3.5" fill={columns} />
      <rect x="42" y="20" width="9" height="32" rx="3.5" fill={columns} />
      <rect x="42" y="9" width="9" height="9" rx="3.5" fill={cap} />
    </svg>
  );
}

/**
 * Mark plus wordmark. `markClassName` sizes the mark; the word scales with the
 * surrounding type so a lockup in a sidebar and one in a hero stay in
 * proportion without a size prop for every context.
 */
export function ElevateLockup({
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
    variant === "reversed" || variant === "gold"
      ? "text-white"
      : variant === "mono"
        ? "text-current"
        : "text-neutral-900";

  const stop = variant === "mono" ? "text-current" : "text-accent-500";

  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <ElevateMark variant={variant} className={markClassName} />
      <span
        className={`font-heading font-semibold tracking-[-0.02em] leading-none ${word} ${wordClassName}`}
      >
        Elevate<span className={stop}>.</span>
      </span>
    </span>
  );
}
