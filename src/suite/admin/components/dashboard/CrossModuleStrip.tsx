import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { PRODUCTS, type ProductSlug } from "@/lib/products";

/**
 * What Admin hands to the rest of the suite.
 *
 * The reason these shells exist at all is the claim that five modules share
 * one spine, and a dashboard that never mentions the other four quietly
 * withdraws the claim. Every card here is a real link into the module that
 * receives the record.
 *
 * All three point outward on purpose. Admin is the chassis: it defines the
 * organisation, the approvals and the policies that the other modules inherit,
 * so nearly everything it does leaves it.
 */

interface Handoff {
  to: ProductSlug;
  /** What crosses the boundary. */
  artefact: string;
  detail: string;
}

const HANDOFFS: readonly Handoff[] = [
  {
    to: "finance",
    artefact: "Purchase orders and fixed assets",
    detail:
      "A requisition that clears the matrix becomes a purchase order, then a goods-received note. Finance gets a bill already matched to both.",
  },
  {
    to: "lms",
    artefact: "Policy acknowledgement courses",
    detail:
      "A published policy becomes a course with a completion record and a date, rather than a signature in a drawer.",
  },
  {
    to: "hrm",
    artefact: "Org tree, positions and locations",
    detail:
      "Admin defines the organisation; HRM staffs it. A person, a desk and an access group are one record, created once.",
  },
];

export function CrossModuleStrip() {
  return (
    <section aria-labelledby="admin-handoffs" className="pt-2">
      <h2
        id="admin-handoffs"
        className="font-heading text-lg font-bold tracking-tight text-neutral-900"
      >
        What Admin hands on
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-600">
        One organisation, one approval matrix, one audit log. These are the
        records that leave Admin and arrive somewhere else already matched.
      </p>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {HANDOFFS.map((handoff) => {
          const product = PRODUCTS[handoff.to];

          return (
            <li key={handoff.to}>
              <Link
                href={product.appHref}
                className="group flex h-full flex-col ws-card p-5 transition-shadow duration-200 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
              >
                <div className="flex items-center gap-3">
                  <ProductIcon product={product} size="sm" />
                  <span className="min-w-0">
                    <span className="label-mono block text-neutral-500">
                      Admin → {product.shortName}
                    </span>
                    <span className="block truncate text-sm font-semibold text-neutral-900">
                      {product.name}
                    </span>
                  </span>
                </div>
                <p className="mt-3 text-sm font-medium text-neutral-900">
                  {handoff.artefact}
                </p>
                <p className="mt-1 flex-1 text-sm leading-relaxed text-neutral-600">
                  {handoff.detail}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700">
                  Open {product.shortName}
                  <ArrowRight
                    className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
