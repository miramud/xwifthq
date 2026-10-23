import { PRODUCT_LIST } from "@/lib/products";

/**
 * The band under the hero.
 *
 * The template runs a scrolling strip of single words here, and it is doing two
 * jobs: it puts a hard horizontal rule between the hero and the page, and it
 * gets a list of nouns in front of the reader before any of them has to be
 * argued for. Both are worth keeping, so both are kept — with the five real
 * module names instead of "Innovation / Success / Leadership".
 *
 * Deep Teal, full bleed. The hero moved to Mist to give the display type room,
 * and this is where the brand colour comes back: it lands roughly one screen
 * in, which is about where a reader has finished the headline and is looking
 * for what kind of site this is.
 *
 * The list is rendered twice. The track travels exactly one copy's width and
 * restarts, so the seam falls where the first copy ended and never shows. The
 * second copy is `aria-hidden` — it is the same five words again, and a screen
 * reader should hear them once.
 */
export function SuiteMarquee() {
  const items = PRODUCT_LIST;

  return (
    <section className="relative overflow-hidden bg-primary-600 py-6 sm:py-7">
      <h2 className="sr-only">The five Elevate modules</h2>

      <div className="marquee-mask flex">
        <ul className="animate-marquee flex items-center" aria-label="Elevate modules">
          {[0, 1].map((copy) => (
            <li key={copy} aria-hidden={copy === 1 ? "true" : undefined}>
              <ul className="flex items-center">
                {items.map((product) => {
                  const Glyph = product.icon;

                  return (
                    <li
                      key={product.slug}
                      className="flex items-center gap-4 px-7 sm:px-10"
                    >
                      <Glyph
                        className="h-5 w-5 shrink-0 text-accent-400"
                        aria-hidden="true"
                      />
                      <span className="font-heading whitespace-nowrap text-xl font-semibold text-white sm:text-2xl">
                        {product.name}
                      </span>
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/30"
                        aria-hidden="true"
                      />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
