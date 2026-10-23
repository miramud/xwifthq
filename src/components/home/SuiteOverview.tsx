import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { SectionIntro } from "@/components/home/SectionIntro";
import { HUE, PRODUCT_LIST } from "@/lib/products";

/**
 * The five products, as the template's service grid.
 *
 * This used to be a thin wrapper around `SuiteGrid`. It renders its own cards
 * now, and the reason is scope rather than taste: `SuiteGrid` is what `/platform`
 * and the product pages use, and dragging the home page's layout language into
 * it would redesign four other pages by accident. The registry is still the only
 * source — names, taglines, hues, routes and pillars all come out of
 * `PRODUCT_LIST`, so nothing here can drift from the product pages.
 *
 * The template's card is an icon tile, a title, a line of prose and a checklist
 * of three. The checklist is the product's first three pillars, which is the
 * closest true thing to the template's three bullet points.
 *
 * Five cards in a three-column grid leave a hole. The sixth cell is a teal tile
 * pointing at the platform page — the grid is full because there is somewhere
 * else to go, not because a card was stretched to cover the gap.
 */
export function SuiteOverview() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <SectionIntro
          eyebrow="Our modules"
          title="Five modules for the way a company actually runs."
          intro="Money first, then operations, people and delivery — with staff training alongside. All five are live, and each can be switched on for your organisation on its own."
        />

        <ul className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PRODUCT_LIST.map((product) => {
            const hue = HUE[product.hue];
            const Glyph = product.icon;

            return (
              <li key={product.slug}>
                <Link
                  href={product.href}
                  className="group flex h-full flex-col rounded-2xl border border-neutral-200 bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary-500/40 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                >
                  <span
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl ${hue.tile}`}
                  >
                    <Glyph className={`h-8 w-8 ${hue.icon}`} aria-hidden="true" />
                  </span>

                  <div className="mt-6 flex items-center gap-3">
                    <h3 className="font-heading text-xl font-semibold text-neutral-900 transition-colors duration-200 group-hover:text-primary-700">
                      {product.name}
                    </h3>
                    <span className="label-mono rounded-full bg-primary-500/10 px-2.5 py-1 text-primary-700">
                      Live
                    </span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-neutral-600">
                    {product.summary}
                  </p>

                  <ul className="mt-6 space-y-2.5 border-t border-dashed border-neutral-300 pt-6">
                    {product.pillars.slice(0, 3).map((pillar) => (
                      <li
                        key={pillar.title}
                        className="flex items-start gap-2.5 text-sm text-neutral-700"
                      >
                        <Check
                          className="mt-0.5 h-4 w-4 shrink-0 text-primary-600"
                          aria-hidden="true"
                        />
                        {pillar.title}
                      </li>
                    ))}
                  </ul>

                  <span className="mt-6 inline-flex items-center gap-2 pt-1 text-sm font-semibold text-primary-600">
                    Explore {product.shortName}
                    <ArrowRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </li>
            );
          })}

          {/* The sixth cell. */}
          <li>
            <Link
              href="/platform"
              className="group flex h-full flex-col justify-between rounded-2xl bg-primary-600 p-7 transition-colors duration-300 hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
            >
              <h3 className="font-heading text-2xl font-semibold leading-snug text-white">
                See what one module hands to the next — and what they all share.
              </h3>
              <span className="mt-10 inline-flex items-center gap-3 text-sm font-semibold text-white">
                The platform, end to end
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-primary-700 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0">
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </span>
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
