import { Check } from "lucide-react";
import { ProductScreenshot, type ScreenKey } from "@/components/platform/ProductScreenshot";
import { HUE, type ProductHue } from "@/lib/products";

/**
 * One capability, told against the real screen that does it.
 *
 * Copy on one side, the live screen on the other, swapping sides when
 * `reverse` is set so a run of these reads as a zig-zag rather than a column of
 * identical cards. The screen gets the wider share (7 of 12) because it is the
 * evidence; the copy is the caption to it.
 *
 * Colour: the eyebrow rule and the check glyphs take the product's tokens —
 * the module's rule token marks one small dot; the checks and the plate
 * behind the screen stay purple on every page, so no hue ever carries words.
 *
 * Shared by the Finance and Admin & Operations pages.
 */
export function ScreenFeature({
  eyebrow,
  title,
  body,
  points,
  screen,
  hue,
  reverse = false,
}: {
  eyebrow: string;
  title: string;
  body: string;
  points: readonly string[];
  screen: ScreenKey;
  hue: ProductHue;
  reverse?: boolean;
}) {
  const tokens = HUE[hue];

  return (
    <article className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12">
      <div className={`min-w-0 lg:col-span-5 ${reverse ? "lg:order-2" : ""}`}>
        <p className="flex items-center gap-2 text-sm font-semibold text-primary-700">
          <span className={`h-2 w-2 rounded-full ${tokens.rule}`} aria-hidden="true" />
          {eyebrow}
        </p>
        <h3 className="mt-3 font-heading text-2xl font-bold leading-snug tracking-[-0.02em] text-neutral-900 sm:text-[1.75rem]">
          {title}
        </h3>
        <p className="mt-4 max-w-prose leading-relaxed text-neutral-600">{body}</p>
        <ul className="mt-6 space-y-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100" aria-hidden="true">
                <Check className="h-3 w-3 text-primary-700" />
              </span>
              <span className="text-sm leading-relaxed text-neutral-700">{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0 rounded-[1.75rem] bg-gradient-to-br from-primary-100 via-primary-50 to-white p-3 sm:p-6 lg:col-span-7">
        <ProductScreenshot screen={screen} hue={hue} />
      </div>
    </article>
  );
}
