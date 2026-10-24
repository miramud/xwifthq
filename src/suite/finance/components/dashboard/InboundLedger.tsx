import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ProductIcon } from "@/components/platform/ProductIcon";
import { PRODUCTS, type ProductSlug } from "@/lib/products";

/**
 * What arrived in the ledger this period, and which module sent it.
 *
 * Four rows, four documents, four modules. Every figure here is one the
 * sending module shows on its own dashboard (the payroll gross is HRM's run,
 * the matched bills are the ones Admin's purchase orders cleared, the billable
 * hours and the invoice are the pair the shared activity feed records), so a
 * reader can follow any row back to where it came from and find the same
 * number.
 *
 * Each row is a link to the module that sent it, because "one dataset" is only
 * a claim until the screen lets you walk it.
 */

interface InboundRow {
  module: ProductSlug;
  document: string;
  figure: string;
  detail: string;
}

const INBOUND: readonly InboundRow[] = [
  {
    module: "hrm",
    document: "Payroll journal",
    figure: "₦96,800,000",
    detail: "JV-2026-09-30 · 210 employees · gross, split by cost centre",
  },
  {
    module: "admin",
    document: "Purchase orders",
    figure: "4 bills",
    detail: "Arrived matched to a PO and a goods-received note",
  },
  {
    module: "projects",
    document: "Billable time",
    figure: "142 hours",
    detail: "Became invoice INV-2291 · ₦8,400,000 on 30-day terms",
  },
  {
    module: "lms",
    document: "Seat billing",
    figure: "210 seats",
    detail: "Annual plan · renews with the organisation, not per order",
  },
];

export function InboundLedger() {
  return (
    <ul className="space-y-0.5">
      {INBOUND.map((row) => {
        const product = PRODUCTS[row.module];

        return (
          <li key={row.module}>
            <Link
              href={product.appHref}
              className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2.5 outline-none transition-colors hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <ProductIcon product={product} size="sm" />

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold text-neutral-900">{row.document}</span>
                  <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600">from {product.shortName}</span>
                </p>
                <p className="mt-0.5 truncate text-xs tabular-nums text-neutral-500">{row.detail}</p>
              </div>

              <span className="shrink-0 text-right text-sm font-bold tabular-nums text-neutral-900">{row.figure}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-neutral-400" aria-hidden="true" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
