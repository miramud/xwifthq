"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Printer, Receipt as ReceiptIcon, RotateCcw } from "lucide-react";
import { Button, ButtonLink, Card, Chip, Empty } from "@/components/workspace/kit";
import { formatDate } from "@/lib/console-data";
import {
  ApiError,
  STATUS_LABEL,
  amountOf,
  billing,
  gatewayLabel,
  purchaseAmount,
  type Receipt,
} from "@/lib/api/billing-client";
import { formatMoney } from "@/lib/money";

/** Rows from the retired per-period model still name their period. */
const OLD_PERIOD_LABEL: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  biannual: "Every 6 months",
  annual: "Annually",
};
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { STATUS_HUE, describePurchase } from "./PurchaseHistory";

/**
 * One payment, as a receipt an admin can print or save as PDF.
 *
 * Printing is from inside the console, so the print rule hides everything on
 * the page except the receipt rather than asking the shell to know about it.
 */
export function ReceiptView({ id }: { id: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let alive = true;
    billing
      .purchase(id)
      .then((r) => {
        if (!alive) return;
        setReceipt(r);
        setError(null);
      })
      .catch((e: unknown) => {
        if (alive) setError(e instanceof ApiError ? e.message : "The receipt didn't load.");
      });
    return () => {
      alive = false;
    };
  }, [id, reloadKey]);

  if (error && !receipt) {
    return (
      <Card className="mx-auto max-w-2xl p-6">
        <Empty
          icon={ReceiptIcon}
          title="The receipt didn't load."
          hint={error}
          hue="coral"
          action={
            <Button size="sm" icon={RotateCcw} onClick={() => setReloadKey((k) => k + 1)}>
              Try again
            </Button>
          }
        />
      </Card>
    );
  }

  if (!receipt) return <Skeleton className="mx-auto h-[28rem] max-w-2xl" />;

  const lines =
    receipt.lines && receipt.lines.length > 0
      ? receipt.lines.map((l, i) => ({
          key: `${l.module ?? l.label ?? i}`,
          label: l.label ?? l.description ?? l.module ?? "Item",
          startsOn: l.startsOn ?? null,
          endsOn: l.endsOn ?? null,
          deliveredWhenReleased: false,
          amount: amountOf(l),
        }))
      : receipt.modules.map((m) => ({
          key: m.key,
          label: m.label,
          startsOn: m.startsOn ?? null,
          endsOn: m.endsOn ?? null,
          deliveredWhenReleased: m.deliveredWhenReleased === true,
          amount: null as number | null,
        }));
  const oneTime = !receipt.period;

  return (
    <div className="mx-auto max-w-2xl">
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #billing-receipt, #billing-receipt * { visibility: visible !important; }
          #billing-receipt { position: absolute; inset: 0 auto auto 0; width: 100%; box-shadow: none !important; border: 0 !important; }
          .receipt-no-print { display: none !important; }
        }
      `}</style>

      <div className="receipt-no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <ButtonLink href="/suite/org/billing" variant="ghost">
          <ArrowLeft size={16} aria-hidden />
          Plan &amp; billing
        </ButtonLink>
        <Button variant="primary" icon={Printer} onClick={() => window.print()}>
          Print or save as PDF
        </Button>
      </div>

      <article id="billing-receipt" aria-label={`Receipt ${receipt.reference}`} className="ws-card p-6 sm:p-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Receipt</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-neutral-900">{receipt.organisation.name}</h1>
            <p className="mt-1 font-mono text-xs text-neutral-500">{receipt.reference}</p>
          </div>
          <Chip hue={STATUS_HUE[receipt.status] ?? "slate"} dot>
            {STATUS_LABEL[receipt.status] ?? receipt.status}
          </Chip>
        </header>

        <dl className="grid gap-4 py-6 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold text-neutral-500">Billed to</dt>
            <dd className="mt-0.5 text-neutral-900">{receipt.billedTo.name}</dd>
            <dd className="text-neutral-500">{receipt.billedTo.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-neutral-500">Paid</dt>
            <dd className="mt-0.5 text-neutral-900">{formatDate(receipt.paidAt ?? receipt.createdAt)}</dd>
            <dd className="text-neutral-500">via {gatewayLabel(receipt.gateway)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-neutral-500">For</dt>
            <dd className="mt-0.5 text-neutral-900">{describePurchase(receipt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-neutral-500">Terms</dt>
            <dd className="mt-0.5 text-neutral-900">
              {oneTime ? "One-time payment · yours for good" : (OLD_PERIOD_LABEL[receipt.period ?? ""] ?? receipt.period)}
            </dd>
          </div>
        </dl>

        <table className="w-full text-sm">
          <caption className="sr-only">Receipt lines</caption>
          <thead>
            <tr className="border-y border-neutral-200 text-left text-xs font-semibold text-neutral-500">
              <th scope="col" className="py-2.5">Item</th>
              <th scope="col" className="py-2.5">Covers</th>
              <th scope="col" className="py-2.5 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {lines.map((l) => (
              <tr key={l.key}>
                <td className="py-3 font-semibold text-neutral-900">{l.label}</td>
                <td className="py-3 text-neutral-600">
                  {l.startsOn && l.endsOn
                    ? `${formatDate(l.startsOn)} – ${formatDate(l.endsOn)}`
                    : l.deliveredWhenReleased
                      ? "Delivered when released"
                      : oneTime
                        ? "Permanent"
                        : "—"}
                </td>
                <td className="py-3 text-right tabular-nums text-neutral-900">
                  {l.amount === null ? "" : formatMoney(l.amount, receipt.currency)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-neutral-900">
              <th scope="row" colSpan={2} className="py-3 text-left font-bold text-neutral-900">
                Total
              </th>
              <td className="py-3 text-right text-lg font-bold tabular-nums text-neutral-900">
                {purchaseAmount(receipt)}
              </td>
            </tr>
          </tfoot>
        </table>
      </article>
    </div>
  );
}
