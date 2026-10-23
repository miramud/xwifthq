"use client";

import Link from "next/link";
import { Ban, CircleCheckBig, CircleX, ExternalLink, FileWarning, Landmark } from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { Money } from "@/suite/finance/components/banking/ui";
import { memoStatus } from "@/suite/finance/components/requests/labels";
import { day } from "@/suite/finance/lib/format";
import type { VendorInvoice } from "@/lib/api/operations-procurement-client";
import { qty } from "./meta";

/**
 * A vendor's invoice and its three-way match: each line held against the
 * order's price and what was received and accepted. Matched → a payment memo
 * went straight to the FCU (its reference shown); exception → the problems,
 * line by line; rejected → the resolution.
 */
export function InvoiceMatch({
  invoice: inv,
  currency = "NGN",
  memoHref,
  actions,
}: {
  invoice: VendorInvoice;
  currency?: string;
  /** Where the memo opens, when the viewer may see Finance's register. */
  memoHref?: (memoId: string) => string | null;
  actions?: React.ReactNode;
}) {
  const matched = inv.status === "matched";
  const rejected = inv.status === "rejected";
  const head = matched
    ? { hue: "mint" as const, icon: CircleCheckBig, label: "Matched" }
    : rejected
      ? { hue: "slate" as const, icon: Ban, label: "Rejected" }
      : { hue: "rose" as const, icon: FileWarning, label: "Exception" };
  const href = inv.memoId ? memoHref?.(inv.memoId) : null;

  return (
    <article className={cx("overflow-hidden rounded-2xl border", matched ? "border-mint-500/30" : rejected ? "border-neutral-200" : "border-rose-500/30")} aria-label={`Invoice ${inv.invoiceNo}`}>
      <header className={cx("flex flex-wrap items-start justify-between gap-3 px-4 py-3", matched ? "bg-mint-50/60" : rejected ? "bg-neutral-50" : "bg-rose-50/60")}>
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-semibold text-neutral-900">{inv.invoiceNo}</span>
            <Chip hue={head.hue} icon={head.icon}>
              {head.label}
            </Chip>
          </p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {inv.vendor ?? "Vendor"} · dated {day(inv.invoiceDate)}
            {inv.poNumber ? ` · ${inv.poNumber}` : ""}
          </p>
        </div>
        <div className="text-right">
          <Money value={inv.total} currency={currency} className="text-[15px] font-bold text-neutral-900" />
          <p className="text-[11px] text-neutral-500">
            <Money value={inv.subtotal} currency={currency} /> + VAT <Money value={inv.vat} currency={currency} />
          </p>
        </div>
      </header>

      <ul className="divide-y divide-neutral-100">
        {inv.match.map((m) => (
          <li key={`${m.poLineId}-${m.lineNo}`} className="flex gap-3 px-4 py-3">
            <span className={cx("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", m.ok ? "bg-mint-500 text-white" : "bg-rose-500 text-white")} aria-hidden>
              {m.ok ? <CircleCheckBig size={14} /> : <CircleX size={14} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-neutral-900">
                Line {m.lineNo}: {m.description}
                <span className="sr-only">{m.ok ? " matches" : " does not match"}</span>
              </p>
              <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-neutral-500">Invoiced</dt>
                  <dd className="font-semibold tabular-nums text-neutral-800">{qty(m.quantity)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Accepted, not yet invoiced</dt>
                  <dd className={cx("font-semibold tabular-nums", m.quantity > m.available ? "text-rose-700" : "text-neutral-800")}>{qty(m.available)}</dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Invoice price</dt>
                  <dd className={cx("font-semibold", m.unitPrice !== m.orderPrice ? "text-rose-700" : "text-neutral-800")}>
                    <Money value={m.unitPrice} currency={currency} />
                  </dd>
                </div>
                <div>
                  <dt className="text-neutral-500">Order price</dt>
                  <dd className="font-semibold text-neutral-800">
                    <Money value={m.orderPrice} currency={currency} />
                  </dd>
                </div>
              </dl>
              {m.problems.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {m.problems.map((p) => (
                    <li key={p} className="text-sm text-rose-700">
                      {p}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>

      <footer className="border-t border-neutral-100 px-4 py-3 text-sm">
        {matched ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-start gap-2 text-neutral-700">
              <span className={cx("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg", HUE.sky.soft)}>
                <Landmark size={14} aria-hidden />
              </span>
              <span>
                {inv.memo || inv.memoId ? (
                  <>
                    Payment memo raised with the FCU
                    {inv.memo?.reference ? (
                      <>
                        : <span className="font-mono font-semibold text-neutral-900">{inv.memo.reference}</span>
                      </>
                    ) : null}
                    {inv.memo && (
                      <span className="block text-xs text-neutral-500">
                        {memoStatus(inv.memo.status).label} · <Money value={inv.memo.amount} currency={currency} /> to pay
                        {inv.advanceDeducted > 0 && (
                          <>
                            {" "}
                            after the advance of <Money value={inv.advanceDeducted} currency={currency} />
                          </>
                        )}
                      </span>
                    )}
                  </>
                ) : (
                  "Matched. The payment memo is raised when Finance is switched on."
                )}
              </span>
            </p>
            {href && (
              <Link href={href} className="inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold text-primary-700 hover:underline">
                Open the memo
                <ExternalLink size={13} aria-hidden />
              </Link>
            )}
          </div>
        ) : rejected ? (
          <p className="text-neutral-700">
            <span className="font-semibold">Rejected: </span>
            {inv.resolution ?? "No resolution recorded."}
          </p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-rose-700">No payment is raised until this is resolved: a credit note, an amended order, or rejection.</p>
            {actions}
          </div>
        )}
      </footer>
    </article>
  );
}
