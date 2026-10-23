import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Sky } from "@/components/site/Sky";
import { HUE, type Product } from "@/lib/products";

/**
 * The hero every module page opens with, built like the home hero so the
 * five modules read as one product: the lilac sky, a centred promise, two pill
 * buttons, and the module's own screen rising out of the fold with the people
 * who use it floating at its edges.
 *
 * The module's hue appears on the eyebrow dot and the chips only. Both calls
 * to action stay purple and white whatever the module is.
 */
export function ProductHero({
  product,
  title,
  roles = [],
  children,
}: {
  product: Product;
  /** The headline. Falls back to the module's tagline. */
  title?: React.ReactNode;
  /** Up to four short role labels floated around the screen. Decorative. */
  roles?: string[];
  children?: React.ReactNode;
}) {
  const hue = HUE[product.hue];
  const Glyph = product.icon;

  const places = [
    "left-[4%] top-[-1.25rem] lg:left-[6%]",
    "right-[4%] top-[-1.25rem] lg:right-[8%]",
    "-left-3 top-[42%] hidden lg:inline-flex",
    "-right-3 top-[38%] hidden lg:inline-flex",
  ];

  return (
    <Sky>
      <div className="section-container text-center">
        <p className="xw-eyebrow">
          <Glyph className={`h-3.5 w-3.5 ${hue.icon}`} aria-hidden="true" />
          {product.name}
        </p>

        <h1 className="xw-h1 mx-auto mt-6 max-w-3xl">{title ?? product.tagline}</h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-neutral-600 sm:text-lg">
          {product.summary}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href={product.appHref} className="btn-primary w-full sm:w-auto">
            {product.live ? `Open ${product.shortName}` : `Preview ${product.shortName}`}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link href="/get-started" className="btn-outline w-full sm:w-auto">
            Get started free
          </Link>
        </div>

        {children && (
          <div className="relative mx-auto mt-14 max-w-5xl sm:mt-16">
            {roles.slice(0, 4).map((role, i) => (
              <span key={role} className={`xw-chip absolute z-10 ${places[i]}`} aria-hidden="true">
                <span className={`h-2 w-2 rounded-full ${i % 2 === 0 ? hue.rule : "bg-primary-500"}`} />
                {role}
              </span>
            ))}
            <div className="text-left">{children}</div>
            {/* The screen sinks into the white page below. */}
            <div
              className="pointer-events-none absolute inset-x-[-1rem] bottom-0 h-28 bg-gradient-to-b from-transparent to-white"
              aria-hidden="true"
            />
          </div>
        )}
      </div>
    </Sky>
  );
}
