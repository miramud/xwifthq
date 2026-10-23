import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { PRODUCTS, type Product } from "@/lib/products";

/**
 * How one product meets the other four.
 *
 * Each card belongs to the *other* product, so it wears that product's hue on
 * its tile and links to that product's page. Four hues landing in one section
 * is not a lapse in the hue discipline — telling four modules apart is the one
 * job a hue has here, and it is why Elevate Admin's otherwise ink-only page
 * carries colour in this section and nowhere else.
 *
 * This is the section that stops a product page reading as a standalone app,
 * which is why the whole card is the link rather than a "learn more" tucked at
 * the bottom of it: the card is about the other product, so the card goes
 * there.
 *
 * Shared by all five product pages on purpose. It was written five times
 * independently — once per page — and the copies had already begun to drift
 * apart in markup and in contrast before they were folded back together.
 */
export function ProductConnections({ product }: { product: Product }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      {product.connections.map((connection) => {
        const other = PRODUCTS[connection.to];
        return (
          <Link
            key={connection.to}
            href={other.href}
            className="group flex flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
          >
            <div className="flex items-center gap-4">
              <ProductIcon product={other} />
              <h3 className="min-w-0 font-heading text-lg font-semibold text-neutral-900">
                {other.name}
              </h3>
              <ArrowUpRight
                className="ml-auto h-5 w-5 shrink-0 text-neutral-300 transition-colors group-hover:text-primary-600 motion-reduce:transition-none"
                aria-hidden="true"
              />
            </div>

            <p className="mt-4 text-sm leading-relaxed text-neutral-600">
              {connection.description}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
