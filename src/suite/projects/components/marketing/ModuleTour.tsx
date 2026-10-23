import { HUE, type ProductHue } from "@/lib/products";
import {
  ProductScreenshot,
  type ScreenKey,
} from "@/components/platform/ProductScreenshot";

/**
 * "Tour the module": real screens from the running suite, one per stop.
 *
 * Used by the HRM, Projects and Learning product pages (owner, 9 Oct 2026:
 * every product page shows the module's actual dashboards). It lives with the
 * Projects marketing components only because that folder already holds the
 * shared FeatureBlock; it has no Projects-specific behaviour.
 *
 * Layout: the screenshot is the subject, so it takes eight of twelve columns
 * and the words take four, swapping sides down the page. The screenshot sits
 * on a soft lilac plate so a white app screen still reads as an object on a
 * white page. Below `lg` every stop stacks words-then-screen, which is the
 * reading order the markup already has; the alternation is `lg:order-*`
 * only, never a reordering of the DOM.
 *
 * Server-rendered and stateless: no tabs to wire, nothing hidden from a
 * crawler or a screen reader, and every image after the first is lazy.
 */
export interface TourStop {
  screen: ScreenKey;
  /** The area of the module this screen belongs to: a label, not a sentence. */
  area: string;
  title: string;
  /** Two lines at most: what the screen is for, and the one thing to notice. */
  body: string;
}

export function ModuleTour({
  stops,
  hue,
}: {
  stops: TourStop[];
  hue: ProductHue;
}) {
  const tokens = HUE[hue];

  return (
    <ol className="space-y-16 sm:space-y-20 lg:space-y-28">
      {stops.map((stop, index) => {
        const screenFirst = index % 2 === 1;

        return (
          <li
            key={stop.screen}
            className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12"
          >
            <div
              className={`min-w-0 lg:col-span-4 ${screenFirst ? "lg:order-2" : ""}`}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-primary-700">
                <span
                  className={`h-2 w-2 rounded-full ${tokens.rule}`}
                  aria-hidden="true"
                />
                {stop.area}
              </p>
              <h3 className="mt-3 font-heading text-2xl font-bold leading-snug tracking-[-0.02em] text-neutral-900 sm:text-[1.75rem]">
                {stop.title}
              </h3>
              <p className="mt-3 max-w-prose leading-relaxed text-neutral-600">
                {stop.body}
              </p>
            </div>

            <div
              className={`min-w-0 lg:col-span-8 ${screenFirst ? "lg:order-1" : ""}`}
            >
              <div className="rounded-[1.75rem] bg-gradient-to-br from-primary-100 via-primary-50 to-white p-3 sm:p-6">
                <ProductScreenshot screen={stop.screen} hue={hue} />
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
