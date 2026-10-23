import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { HUE, type Product } from "@/lib/products";

/**
 * The hero every product page opens with.
 *
 * It reuses the home hero's furniture on purpose: the same deep teal field, the
 * same ascending rectangles at wallpaper scale, the same white wave to close.
 * Five products that each invented their own opening would read as five
 * companies, and the point of the page is that they are not.
 *
 * The product's hue appears exactly twice here — the icon tile and the eyebrow
 * rule. Both CTAs stay in the teal/white family whatever the product is,
 * because teal leads the whole site and a gold or sky button would make Finance
 * and Projects look like separate brands.
 */
export function ProductHero({
  product,
  children,
}: {
  product: Product;
  children?: React.ReactNode;
}) {
  const hue = HUE[product.hue];
  const Glyph = product.icon;

  return (
    <section className="relative overflow-hidden bg-primary-600">
      {/* The mark's motif at wallpaper scale. Decorative only. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.08]"
        viewBox="0 0 800 500"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <g fill="#ffffff">
          <rect x="40" y="360" width="34" height="70" rx="6" />
          <rect x="92" y="320" width="34" height="110" rx="6" />
          <rect x="144" y="272" width="34" height="158" rx="6" />
          <rect x="196" y="212" width="34" height="218" rx="6" />
          <rect x="560" y="330" width="34" height="100" rx="6" />
          <rect x="612" y="286" width="34" height="144" rx="6" />
          <rect x="664" y="230" width="34" height="200" rx="6" />
          <rect x="716" y="160" width="34" height="270" rx="6" />
        </g>
      </svg>

      <div className="section-container relative z-10">
        <div className="grid items-center gap-12 py-16 md:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
          {/* Left — what this module is */}
          <div className="flex flex-col items-start gap-6">
            {/*
              The eyebrow rule is white here rather than hue.rule. On deep teal
              a 10%-tinted bar in the product's hue is invisible for primary and
              neutral, and barely there for the rest — repeating the label in a
              colour nobody can see is worse than not repeating it. The hue does
              its work on the tile below, where the pairing is contrast-checked.
            */}
            <p className="label-mono flex items-center gap-2.5 text-white/70">
              <span
                className="h-0.5 w-7 rounded-full bg-white/40"
                aria-hidden="true"
              />
              Elevate Suite
            </p>

            <div className="flex items-center gap-4">
              {/*
                A white tile rather than hue.tile: `hue.icon` is calibrated
                against white, so inverting the tile is what keeps Finance's
                gold glyph legible on a dark hero instead of dissolving into it.
              */}
              <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg">
                <Glyph className={`h-7 w-7 ${hue.icon}`} aria-hidden="true" />
              </span>
              <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
                {product.name}
              </h1>
            </div>

            {!product.live && (
              <span className="label-mono inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-white/75 backdrop-blur-sm">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-accent-500"
                  aria-hidden="true"
                />
                Preview — illustrative data
              </span>
            )}

            <p className="max-w-lg text-xl leading-relaxed text-white/85">
              {product.tagline}
            </p>

            <p className="max-w-xl leading-relaxed text-white/70">
              {product.summary}
            </p>

            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href={product.appHref}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-white px-7 py-3.5 text-sm font-semibold text-primary-700 shadow-lg transition-all duration-200 hover:bg-primary-50 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600 active:scale-[0.98]"
              >
                {product.live
                  ? `Open ${product.shortName}`
                  : `Preview ${product.shortName}`}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/platform"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/30 px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-primary-600 active:scale-[0.98]"
              >
                How the suite fits together
              </Link>
            </div>
          </div>

          {/*
            Right — the product's own mock, drawn by the page that owns it.

            Shown at every width, not `hidden lg:block`. These five hand-drawn
            mocks are the thing that separates a product page from a bullet
            list, and hiding them below 1024px hid them from every phone and
            most tablets — i.e. from most of the traffic. Below `lg` the grid
            is single-column, so the mock simply falls under the copy, which is
            the reading order it should have had anyway.
          */}
          {children && <div className="relative">{children}</div>}
        </div>
      </div>

      {/* Every hero on the site terminates on this wave. */}
      <svg
        className="relative -mb-px block w-full"
        viewBox="0 0 1440 60"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 60V20C240 0 480 40 720 30C960 20 1200 0 1440 20V60H0Z"
          fill="white"
        />
      </svg>
    </section>
  );
}
