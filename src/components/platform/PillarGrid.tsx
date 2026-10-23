import { HUE, type ProductHue, type ProductPillar } from "@/lib/products";

/**
 * The six things a module is for.
 *
 * Pillars are headings with a sentence, not features with a checkbox — the
 * capability list below them on every product page does the enumerating. The
 * hue lands on the icon tile only, so a page with six of these still reads as
 * one colour rather than six.
 */
export function PillarGrid({
  pillars,
  hue,
  columns = 3,
}: {
  pillars: ProductPillar[];
  hue: ProductHue;
  columns?: 2 | 3;
}) {
  const tokens = HUE[hue];

  return (
    <div
      className={`grid gap-6 sm:grid-cols-2 ${
        columns === 3 ? "lg:grid-cols-3" : ""
      }`}
    >
      {pillars.map((pillar) => {
        const Glyph = pillar.icon;
        return (
          <div
            key={pillar.title}
            className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm"
          >
            <span
              className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${tokens.tile}`}
            >
              <Glyph className={`h-6 w-6 ${tokens.icon}`} aria-hidden="true" />
            </span>
            <h3 className="mt-5 font-heading text-lg font-semibold text-neutral-900">
              {pillar.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-neutral-600">
              {pillar.description}
            </p>
          </div>
        );
      })}
    </div>
  );
}
