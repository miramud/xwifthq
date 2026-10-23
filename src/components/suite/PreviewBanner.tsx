import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import type { Product } from "@/lib/products";

/**
 * The sentence that keeps the preview honest.
 *
 * Info-tinted rather than gold or red on purpose. Gold is the achievement
 * colour and cannot carry white text anyway; red would read as "something is
 * wrong", and nothing is wrong — this module simply has no API behind it yet.
 * This is a statement of fact, so it gets the calmest surface in the palette
 * and a link to the page that explains what the module will actually do.
 */
export function PreviewBanner({ product }: { product: Product }) {
  return (
    <aside
      aria-label={`${product.name} preview notice`}
      className="flex flex-col gap-2 rounded-xl border border-info-500/25 bg-info-500/5 px-4 py-3 sm:flex-row sm:items-center sm:gap-4"
    >
      <Info
        className="h-5 w-5 shrink-0 text-info-600"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1 text-sm leading-relaxed text-neutral-700">
        <span className="font-semibold text-neutral-900">Preview.</span>{" "}
        {product.name} is not connected to an API yet. Every figure, name and
        row on this page is illustrative sample data, not a reading from an
        organisation.
      </p>
      <Link
        href={product.href}
        className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-white hover:text-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        What {product.shortName} does
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </aside>
  );
}
