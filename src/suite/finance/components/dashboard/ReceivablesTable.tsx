"use client";

import { CircleAlert } from "lucide-react";
import { cx } from "@/components/workspace/kit";
import { Pill } from "@/components/suite/ui";
import { FINANCE_DATA, naira, type ReceivableRow } from "@/lib/suite-data";

/**
 * Receivables, aged, with a real `<tfoot>`.
 *
 * This is the one table in the module that does not use the shared
 * `DataTable`. `DataTable` has no footer slot, and a totals row that lives in
 * `<tbody>` is a row a screen reader announces as another invoice. The markup
 * and the classes below mirror `DataTable` exactly: same focusable scroll
 * region, same header treatment, same right-aligned tabular cells, so the two
 * are indistinguishable on the page and only the footer differs.
 *
 * **Days overdue rides on the row, not on a map in here.** It used to be a
 * lookup keyed by row id in this file, which is a second copy of the register
 * waiting to disagree with the first, and it duly did, still listing a row
 * the fixture no longer has. The number now lives on `ReceivableRow`, measured
 * against `SUITE_AS_AT` (30 September 2026), and against that date the days
 * and the fixture's own ageing buckets agree on every row.
 *
 * The total is "outstanding", so the register holds only invoices actually
 * owed: a settled invoice is not a receivable, and leaving one in inflated
 * this footer by its own amount.
 *
 * Overdue is never carried by colour alone: the status word says "Overdue",
 * the ageing bucket names the band, and the days cell takes an alert glyph.
 */

const rows = FINANCE_DATA.receivables;

const total = rows.reduce((sum, row) => sum + row.amount, 0);
const overdue = rows.filter((row) => row.daysOverdue !== null);
const overdueTotal = overdue.reduce((sum, row) => sum + row.amount, 0);

const HEAD = "whitespace-nowrap bg-primary-50/60 px-4 py-3 text-xs font-semibold text-neutral-600 first:rounded-l-xl last:rounded-r-xl";

function DaysCell({ row }: { row: ReceivableRow }) {
  const days = row.daysOverdue;

  if (days === null) {
    return (
      <>
        <span aria-hidden="true">-</span>
        <span className="sr-only">Not overdue</span>
      </>
    );
  }

  return (
    <span className="inline-flex items-center justify-end gap-1.5 font-semibold text-neutral-900">
      <CircleAlert
        className="h-3.5 w-3.5 shrink-0 text-sun-700"
        aria-hidden="true"
      />
      <span className="tnum">{days}</span>
      <span className="sr-only">days overdue</span>
    </span>
  );
}

export function ReceivablesTable() {
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Receivables ageing"
      className="overflow-x-auto rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300"
    >
      <table className="w-full min-w-[42rem] border-collapse text-sm">
        <caption className="sr-only">
          Receivables ageing at 30 September 2026: customer, invoice, due date,
          ageing band, days overdue and amount, with totals.
        </caption>
        <thead>
          <tr>
            <th scope="col" className={cx(HEAD, "text-left")}>
              Customer
            </th>
            <th scope="col" className={cx(HEAD, "text-left")}>
              Invoice
            </th>
            <th scope="col" className={cx(HEAD, "text-left")}>
              Due
            </th>
            <th scope="col" className={cx(HEAD, "text-left")}>
              Ageing
            </th>
            <th scope="col" className={cx(HEAD, "text-right")}>
              Days overdue
            </th>
            <th scope="col" className={cx(HEAD, "text-right")}>
              Amount
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-neutral-100 transition-colors hover:bg-neutral-50"
            >
              <th
                scope="row"
                className="px-4 py-3 text-left align-middle font-normal"
              >
                <span className="block text-sm font-semibold text-neutral-900">
                  {row.customer}
                </span>
                <span className="block text-xs text-neutral-500">
                  Issued {row.issued}
                </span>
              </th>
              <td className="px-4 py-3 align-middle text-neutral-700 tnum">
                {row.invoice}
              </td>
              <td className="whitespace-nowrap px-4 py-3 align-middle text-neutral-700 tnum">
                {row.due}
              </td>
              <td className="px-4 py-3 align-middle">
                <Pill tone={row.tone}>{row.status}</Pill>
                <span className="mt-1 block text-[11px] text-neutral-500">
                  {row.ageing}
                </span>
              </td>
              <td className="px-4 py-3 text-right align-middle text-neutral-700 tnum">
                <DaysCell row={row} />
              </td>
              <td className="px-4 py-3 text-right align-middle font-medium text-neutral-900 tnum">
                {naira(row.amount)}
              </td>
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="bg-primary-50/60">
            <th scope="row" className="rounded-tl-xl px-4 py-3 text-left text-sm font-semibold text-neutral-900">
              Total outstanding
            </th>
            <td className="px-4 py-3 text-left text-xs text-neutral-500 tnum" colSpan={4}>
              {rows.length} invoices
            </td>
            <td className="rounded-tr-xl px-4 py-3 text-right text-sm font-bold text-neutral-900 tnum">
              {naira(total)}
            </td>
          </tr>
          <tr className="bg-primary-50/60">
            <th scope="row" className="rounded-bl-xl px-4 pb-3 text-left text-xs font-medium text-neutral-600">
              Of which overdue
            </th>
            <td className="px-4 pb-3 text-left text-xs text-neutral-500 tnum" colSpan={4}>
              {overdue.length} invoices past their due date
            </td>
            <td className="rounded-br-xl px-4 pb-3 text-right text-sm font-semibold text-neutral-900 tnum">
              {naira(overdueTotal)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
