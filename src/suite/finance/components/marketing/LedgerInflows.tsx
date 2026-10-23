import { ArrowDown, Landmark, Repeat } from "lucide-react";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { PRODUCTS, type ProductSlug } from "@/lib/products";

/**
 * Three modules, one journal.
 *
 * This is the one diagram on the Finance page where other modules' icons
 * appear, and that is legitimate because the diagram is about those modules:
 * telling them apart is exactly what the reader is doing here. The three
 * sources sit on pale rows and converge on the ledger, drawn as the one purple
 * gradient card in the section.
 *
 * Real markup rather than `role="img"`: each source names something specific it
 * carries, and those sentences are worth reading out. The connectors are
 * decoration on top of a list that already has an order.
 */

interface Inflow {
  slug: ProductSlug;
  carries: string;
  detail: string;
}

const INFLOWS: readonly Inflow[] = [
  {
    slug: "hrm",
    carries: "The payroll journal",
    detail: "Posted by cost centre when the run is approved, then paid through the same voucher pipeline.",
  },
  {
    slug: "projects",
    carries: "Labour at the rate card",
    detail: "Logged hours are costed per person, so every project's labour is an actual, not an estimate.",
  },
  {
    slug: "admin",
    carries: "Purchases, trips and events",
    detail: "Committed against the project's funds on approval. Vendor invoices arrive already three-way matched.",
  },
];

export function LedgerInflows() {
  return (
    <div className="xw-frame p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div>
          <p className="text-[11px] text-neutral-500">Posting sources</p>
          <p className="font-heading text-sm font-bold text-neutral-900">
            What posts to the ledger
          </p>
        </div>
        <span className="rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-medium text-neutral-600">
          Three modules, one journal
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,12rem)] sm:items-center sm:gap-0">
        <ul className="space-y-2.5">
          {INFLOWS.map((inflow) => {
            const product = PRODUCTS[inflow.slug];
            return (
              <li
                key={inflow.slug}
                className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-3"
              >
                <span className="shrink-0 rounded-full bg-white">
                  <ProductIcon product={product} size="sm" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-neutral-900">
                    {product.shortName}
                    <span className="text-neutral-300"> · </span>
                    <span className="font-normal text-neutral-700">
                      {inflow.carries}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-neutral-500">
                    {inflow.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>

        <svg
          className="hidden h-full w-10 self-stretch sm:block"
          viewBox="0 0 40 120"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g className="stroke-primary-200" strokeWidth="1.5">
            <path d="M0 20C18 20 22 60 40 60" vectorEffect="non-scaling-stroke" />
            <path d="M0 60H40" vectorEffect="non-scaling-stroke" />
            <path d="M0 100C18 100 22 60 40 60" vectorEffect="non-scaling-stroke" />
          </g>
          <circle cx="37" cy="60" r="2.5" className="fill-primary-600" />
        </svg>

        <div className="flex justify-center sm:hidden" aria-hidden="true">
          <ArrowDown className="h-5 w-5 text-primary-300" />
        </div>

        <div className="rounded-2xl bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 p-4 text-white">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15"
            aria-hidden="true"
          >
            <Landmark className="h-4 w-4 text-white" />
          </span>
          <p className="mt-3 font-heading text-sm font-semibold">
            General ledger
          </p>
          <p className="mt-1 text-xs leading-relaxed text-primary-100">
            One chart of accounts. One audit trail, leading back to the action
            behind every entry.
          </p>
          {/*
            The guarantee gets a pill of its own: a retried webhook is the
            failure every payments integration ships with, and this one is
            designed out.
          */}
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-primary-700">
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            Idempotent
          </p>
        </div>
      </div>

      <p className="mt-5 rounded-2xl bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600">
        Every hand-off between modules is keyed and delivered exactly once. A
        retried event or a double-submitted payment run still posts only once.
        That is an engineering guarantee, not a policy.
      </p>
    </div>
  );
}
