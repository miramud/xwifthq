import { HUE, type ProductHue, type ProductPillar } from "@/lib/products";

/** Which of six tiles span two columns on wide screens. */
const WIDE = new Set([0, 3, 5]);

/**
 * The six things a module is for, as a bento of pale tiles. On wide screens
 * three of the six span two columns and carry a lilac wash (first, fourth and
 * sixth), which fills three rows exactly: wide and narrow, narrow and wide,
 * narrow and wide. Any other count falls back to an even grid. The module's
 * hue lands on the icon only.
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
  const three = columns === 3;

  return (
    <div className={`grid gap-5 sm:grid-cols-2 ${three ? "lg:grid-cols-3" : ""}`}>
      {pillars.map((pillar, i) => {
        const Glyph = pillar.icon;
        const lead = three && pillars.length === 6 && WIDE.has(i);

        return (
          <article
            key={pillar.title}
            className={`flex flex-col p-6 sm:p-7 ${lead ? "xw-glow-card lg:col-span-2" : "xw-tile"}`}
          >
            <span
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]"
              aria-hidden="true"
            >
              <Glyph className={`h-5 w-5 ${tokens.icon}`} />
            </span>
            <h3 className={`xw-h3 mt-5 ${lead ? "sm:text-xl" : ""}`}>{pillar.title}</h3>
            <p className={`mt-2 text-sm leading-relaxed text-neutral-600 ${lead ? "max-w-xl sm:text-base" : ""}`}>
              {pillar.description}
            </p>
          </article>
        );
      })}
    </div>
  );
}
