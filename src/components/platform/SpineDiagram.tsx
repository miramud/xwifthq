import { PRODUCT_LIST, HUE, SPINE_FACILITIES } from "@/lib/products";

/**
 * The company, drawn: five modules, each its own column in its own hue, all
 * standing on one purple base. The base is the shared foundation (one
 * identity, one org tree, one permission model, one audit log, one
 * notification layer, one reporting layer) and it is drawn wider than the
 * columns because it is what holds them up.
 *
 * Deliberately built from boxes rather than shipped as an image: it has to stay
 * legible from 320px, it has to inherit the brand tokens when they change, and
 * a raster of this at any size would be a lie about how the site is built.
 *
 * The whole thing is one `role="img"`. Read aloud, five column labels and six
 * bar labels are a word salad; the sentence in `aria-label` is what the picture
 * actually says.
 */

/** Ascending, because the point is that the columns rise. */
const COLUMN_HEIGHT = ["46%", "60%", "73%", "86%", "100%"] as const;

const SPINE_SENTENCE = SPINE_FACILITIES.map((f) => f.label.toLowerCase()).join(
  ", ",
);

export function SpineDiagram({ className = "" }: { className?: string }) {
  return (
    <div
      className={className}
      role="img"
      aria-label={`Five XwiftHQ modules (${PRODUCT_LIST.map((p) => p.shortName).join(", ")}) drawn as rising columns standing on one shared foundation of ${SPINE_SENTENCE}.`}
    >
      {/* The five columns */}
      <div className="flex items-end gap-2 sm:gap-4">
        {PRODUCT_LIST.map((product, index) => {
          const hue = HUE[product.hue];
          const Glyph = product.icon;

          return (
            <div
              key={product.slug}
              className="flex min-w-0 flex-1 flex-col items-center gap-3"
            >
              <span
                className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11 ${hue.tile}`}
              >
                <Glyph
                  className={`h-4 w-4 sm:h-5 sm:w-5 ${hue.icon}`}
                  aria-hidden="true"
                />
              </span>

              <span className="w-full truncate text-center text-xs font-semibold text-neutral-600">
                {product.shortName}
              </span>

              {/* The column itself. `.animate-grow-up` already sits behind
                  prefers-reduced-motion, so this needs no guard of its own.
                  No per-column stagger: the utility's fill-mode is `forwards`
                  only, so a delay would show the bar at full height first and
                  then snap it back to nothing. */}
              <div className="flex h-28 w-full items-end sm:h-40">
                <div
                  className={`animate-grow-up w-full rounded-t-xl rounded-b-sm ${hue.rule}`}
                  style={{ height: COLUMN_HEIGHT[index] }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* The spine the columns stand on */}
      <div className="rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 px-4 py-4 sm:px-6">
        <p className="text-center text-xs font-semibold text-primary-100">
          One shared foundation
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5">
          {SPINE_FACILITIES.map((facility) => {
            const Glyph = facility.icon;
            return (
              <span
                key={facility.label}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-white sm:text-sm"
              >
                <Glyph
                  className="h-3.5 w-3.5 shrink-0 text-white/60"
                  aria-hidden="true"
                />
                {facility.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
