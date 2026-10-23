import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

/**
 * The landing page's call to action.
 *
 * The corporate template's button is a lozenge with the label on the left and
 * the arrow riding in its own circle on the right, and that circle is most of
 * why the shape reads as it does — a plain rounded button with an arrow glued
 * to the text is a different object. The geometry is the template's: a tall
 * left inset, a flush right one, and a capsule that is exactly as tall as the
 * button's content box.
 *
 * `.btn-primary` and friends in `globals.css` are untouched and still own every
 * other surface. This lives here because it is a home-page shape, and putting
 * it in the global sheet would invite it onto pages that are not built for it.
 *
 * Four tones, and the constraint behind them is the brand's one hard rule:
 *
 *   solid    Deep Teal with white text        (9.3:1)
 *   accent   Summit Gold with Ink text        (7.7:1) — never white on gold
 *   light    White with Teal text, for teal   (9.3:1 inverted)
 *   outline  Ink text inside a Line hairline
 *
 * The icon capsule inverts its parent, so on `accent` it is Ink-on-gold reading
 * gold-on-Ink, which is the same pair the other way round and equally safe.
 */

const TONE = {
  solid: {
    shell:
      "bg-primary-600 text-white hover:bg-primary-700 focus-visible:ring-primary-500",
    capsule: "bg-white text-primary-700",
  },
  accent: {
    shell:
      "bg-accent-500 text-neutral-900 hover:bg-accent-400 focus-visible:ring-accent-500",
    capsule: "bg-neutral-900 text-accent-400",
  },
  light: {
    shell:
      "bg-white text-primary-700 hover:bg-primary-50 focus-visible:ring-white",
    capsule: "bg-primary-600 text-white",
  },
  outline: {
    shell:
      "border border-neutral-300 bg-transparent text-neutral-900 hover:border-primary-600 hover:text-primary-700 focus-visible:ring-primary-500",
    capsule: "bg-primary-600 text-white",
  },
} as const;

export type PillTone = keyof typeof TONE;

export function PillLink({
  href,
  label,
  tone = "solid",
  icon: Icon = ArrowRight,
  className = "",
}: {
  href: string;
  label: string;
  tone?: PillTone;
  icon?: LucideIcon;
  className?: string;
}) {
  const tokens = TONE[tone];

  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 rounded-full py-1.5 pl-6 pr-1.5 text-sm font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${tokens.shell} ${className}`}
    >
      {label}
      <span
        className={`flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0 ${tokens.capsule}`}
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
    </Link>
  );
}
