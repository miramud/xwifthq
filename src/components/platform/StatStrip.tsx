import { Plus } from "lucide-react";

import { type ProductHue } from "@/lib/products";

/**
 * Four figures in staggered cards, the same shape as the home page's "why
 * teams switch" row. They are facts about how the module is built, checkable
 * on the page, rather than adoption numbers nobody can source.
 *
 * The label comes first in the markup (a `dt` must precede its `dd`) and is
 * moved under the figure with `order`, so the visual reads number first.
 * Values carry `.tnum` so a row of them lines up on the digit.
 */
export function StatStrip({
  stats,
}: {
  stats: { label: string; value: string; note?: string }[];
  hue?: ProductHue;
}) {
  return (
    <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
      {stats.map((stat, i) => (
        <div
          key={stat.label}
          className={`flex min-h-52 flex-col p-6 ${
            i % 2 === 0 ? "xw-glow-card lg:min-h-60" : "xw-tile lg:mt-8"
          }`}
        >
          <dt className="order-2 mt-auto pt-8 text-sm font-semibold text-neutral-900">
            {stat.label}
            {stat.note && (
              <span className="mt-1 block font-normal leading-relaxed text-neutral-600">{stat.note}</span>
            )}
          </dt>
          <dd className="order-1 flex items-start justify-between gap-4">
            <span className="tnum font-heading text-4xl font-bold tracking-[-0.04em] text-neutral-900 sm:text-[2.6rem]">
              {stat.value}
            </span>
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-600 text-white"
              aria-hidden="true"
            >
              <Plus className="h-3.5 w-3.5" />
            </span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
