import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { PRODUCTS, type ProductSlug } from "@/lib/products";

/**
 * Finance is the module everything flows into, drawn rather than asserted.
 *
 * Every card runs left to right — sending module, arrow, Finance — so the
 * direction is the shape of the card before it is a word in the card. All four
 * arrows point the same way for the same reason: Finance raises almost nothing
 * on its own. Work, people, spend and seats happen elsewhere and settle here,
 * and a ledger that has to be told about them by email is the problem this
 * module exists to remove.
 *
 * The cards link back to the sender, not forward to Finance — the reader is
 * already in Finance.
 */

interface Inflow {
  module: ProductSlug;
  what: string;
  detail: string;
}

const INFLOWS: readonly Inflow[] = [
  {
    module: "hrm",
    what: "Payroll, as a journal",
    detail:
      "The run that pays people posts the journal. No export, no re-key, and the employer cost is in the ledger the same hour it is approved.",
  },
  {
    module: "admin",
    what: "Spend, already matched",
    detail:
      "A requisition clears the approval matrix in Admin, so the bill arrives against its purchase order and goods-received note. Finance approves, it does not reconcile.",
  },
  {
    module: "projects",
    what: "Work, as billable lines",
    detail:
      "Time entries marked billable become draft invoice lines against the contract they were logged on. The invoice is a review, not a rebuild.",
  },
  {
    module: "lms",
    what: "Seats, as recurring revenue",
    detail:
      "Institutional seat billing is a subscription against the organisation and is kept off the one-off order ledger, so renewals never read as new sales.",
  },
];

const finance = PRODUCTS.finance;

export function FinanceInflows() {
  return (
    <section aria-labelledby="finance-inflows">
      <h2
        id="finance-inflows"
        className="font-heading text-base font-semibold text-neutral-900"
      >
        Everything settles here
      </h2>
      <p className="mt-1 max-w-2xl text-sm text-neutral-500">
        Four modules, one ledger and one tenancy boundary. Each of these is a
        document Finance receives rather than a figure it is told.
      </p>

      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {INFLOWS.map((inflow) => {
          const source = PRODUCTS[inflow.module];

          return (
            <li key={inflow.module}>
              <Link
                href={source.appHref}
                className="group flex h-full flex-col ws-card p-5 transition-shadow duration-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                <div className="flex items-center gap-2">
                  <ProductIcon product={source} size="sm" />
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-neutral-300"
                    aria-hidden="true"
                  />
                  <ProductIcon product={finance} size="sm" />
                </div>

                <p className="label-mono mt-3 text-neutral-500">
                  {source.shortName} to {finance.shortName}
                </p>
                <p className="mt-1 text-sm font-semibold text-neutral-900">
                  {inflow.what}
                </p>
                <p className="mt-1.5 flex-1 text-xs leading-relaxed text-neutral-500">
                  {inflow.detail}
                </p>

                <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-primary-600 transition-colors group-hover:text-primary-700">
                  Open {source.shortName}
                  <ArrowRight
                    className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
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
