import { HUE, type ProductHue } from "@/lib/products";

/**
 * Four figures across the top of a product page.
 *
 * These are capability-shaped on purpose — "3-level hierarchy", "3-way match" —
 * because an adoption number nobody can attribute is worth less than a fact
 * about the product that is checkable on the same page.
 *
 * Values carry `.tnum` so a row of them lines up on the digit rather than
 * shuffling by a pixel per glyph.
 */
export function StatStrip({
  stats,
  hue,
}: {
  stats: { label: string; value: string; note?: string }[];
  hue: ProductHue;
}) {
  const tokens = HUE[hue];

  return (
    <dl className="grid gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="bg-white p-6">
          <dt className="label-mono text-neutral-500">{stat.label}</dt>
          <dd className="tnum mt-2 font-heading text-2xl font-bold text-neutral-900 sm:text-3xl">
            {stat.value}
          </dd>
          {stat.note && (
            <p className="mt-2 flex items-start gap-2.5 text-sm leading-relaxed text-neutral-500">
              <span
                className={`mt-2 h-1 w-4 shrink-0 rounded-full ${tokens.rule}`}
                aria-hidden="true"
              />
              {stat.note}
            </p>
          )}
        </div>
      ))}
    </dl>
  );
}
