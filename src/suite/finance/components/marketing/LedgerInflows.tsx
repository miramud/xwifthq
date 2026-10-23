import { ArrowDown, Landmark, Repeat } from "lucide-react";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { PRODUCTS, type ProductSlug } from "@/lib/products";

/**
 * Three modules, one journal.
 *
 * This is the one diagram on the Finance page where other modules' hues appear,
 * and it is legitimate because the diagram is *about* those modules —
 * telling them apart is exactly what the reader is doing here. Everywhere else
 * on the page the only hue is gold, and gold marks numbers rather than chrome.
 *
 * Real markup rather than `role="img"`: each source names something specific it
 * carries, and those sentences are worth reading out. The arrows are
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
    detail: "Logged hours costed per person, so every project's labour is an actual, not an estimate.",
  },
  {
    slug: "admin",
    carries: "Purchases, trips and events",
    detail: "Committed against the project's funds on approval; vendor invoices arrive three-way matched.",
  },
];

export function LedgerInflows() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          What posts to the ledger
        </p>
        <p className="label-mono text-neutral-500">Three modules, one journal</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,12rem)] sm:items-center sm:gap-0">
        <ul className="space-y-2.5">
          {INFLOWS.map((inflow) => {
            const product = PRODUCTS[inflow.slug];
            return (
              <li
                key={inflow.slug}
                className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3"
              >
                <ProductIcon product={product} size="sm" />
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
          <g stroke="#b7c7c6" strokeWidth="1.5">
            <path d="M0 20C18 20 22 60 40 60" vectorEffect="non-scaling-stroke" />
            <path d="M0 60H40" vectorEffect="non-scaling-stroke" />
            <path d="M0 100C18 100 22 60 40 60" vectorEffect="non-scaling-stroke" />
          </g>
          <circle cx="37" cy="60" r="2.5" fill="#b7801b" />
        </svg>

        <div className="flex justify-center sm:hidden" aria-hidden="true">
          <ArrowDown className="h-5 w-5 text-neutral-300" />
        </div>

        <div className="rounded-xl border border-accent-500/30 bg-accent-500/10 p-4">
          <Landmark className="h-5 w-5 text-accent-700" aria-hidden="true" />
          <p className="mt-2 font-heading text-sm font-semibold text-neutral-900">
            General ledger
          </p>
          <p className="mt-1 text-xs leading-relaxed text-neutral-700">
            One chart of accounts. One audit trail, back to the action that
            caused the entry.
          </p>
          {/*
            Ink on solid gold. The guarantee is the reward here — a retried
            webhook is the failure every payments integration ships with — so it
            gets the brand's one full-strength fill, and never white text on it.
          */}
          <p className="label-mono mt-3 inline-flex items-center gap-1.5 rounded-full bg-accent-500 px-2.5 py-1 text-neutral-900">
            <Repeat className="h-3.5 w-3.5" aria-hidden="true" />
            Idempotent
          </p>
        </div>
      </div>

      <p className="mt-4 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
        Every hand-off between modules is keyed and delivered exactly once, so a
        retried event or a double-submitted payment run posts once. That is an
        engineering guarantee, not a policy.
      </p>
    </div>
  );
}
