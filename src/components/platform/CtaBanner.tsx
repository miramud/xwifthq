import Link from "next/link";
import { ArrowRight } from "lucide-react";

/**
 * The band that closes a page.
 *
 * Deep teal, because that is what a CTA band is for on this site — and the
 * primary action is white-on-teal whatever product page it sits under. A gold
 * or violet button here would be the fastest way to make five products look
 * like five companies. Where gold is wanted, `.btn-accent` is the only form it
 * takes: Ink on gold, never white.
 */
export function CtaBanner({
  title,
  intro,
  primary,
  secondary,
}: {
  title: string;
  intro?: string;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="relative overflow-hidden bg-primary-700">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 800 260"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g fill="#ffffff">
          <rect x="560" y="176" width="30" height="60" rx="6" />
          <rect x="606" y="148" width="30" height="88" rx="6" />
          <rect x="652" y="112" width="30" height="124" rx="6" />
          <rect x="698" y="66" width="30" height="170" rx="6" />
        </g>
      </svg>

      <div className="section-container relative z-10 py-14 sm:py-16">
        <div className="flex flex-col items-start gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="heading-3 text-white">{title}</h2>
            {intro && (
              <p className="mt-3 leading-relaxed text-white/70">{intro}</p>
            )}
          </div>

          <div className="flex flex-wrap gap-4">
            <Link
              href={primary.href}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-primary-700 shadow-lg transition-all duration-200 hover:bg-primary-50 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-700 active:scale-[0.98]"
            >
              {primary.label}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            {secondary && (
              <Link
                href={secondary.href}
                className="inline-flex items-center justify-center rounded-lg border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-700 active:scale-[0.98]"
              >
                {secondary.label}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
