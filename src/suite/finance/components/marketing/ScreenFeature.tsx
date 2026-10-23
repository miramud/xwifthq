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
 * `HUE[hue].rule` for the bar and `HUE[hue].icon` for glyphs, both calibrated
 * for non-text use on white. No hue ever carries words here, which is what
 * lets Finance's Summit Gold appear at all.
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
        <p className="label-mono flex items-center gap-2.5 text-neutral-500">
          <span className={`h-0.5 w-7 rounded-full ${tokens.rule}`} aria-hidden="true" />
          {eyebrow}
        </p>
        <h3 className="heading-4 mt-3 text-neutral-900">{title}</h3>
        <p className="mt-4 max-w-prose leading-relaxed text-neutral-600">{body}</p>
        <ul className="mt-6 space-y-2.5 border-t border-neutral-200 pt-6">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-2.5">
              <Check className={`mt-0.5 h-4 w-4 shrink-0 ${tokens.icon}`} aria-hidden="true" />
              <span className="text-sm leading-relaxed text-neutral-700">{point}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="min-w-0 lg:col-span-7">
        <ProductScreenshot screen={screen} hue={hue} />
      </div>
    </article>
  );
}
