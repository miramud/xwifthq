import { CircleCheck, CircleX } from "lucide-react";
import { Pill } from "@/components/suite/ui";
import { FINANCE_DATA, naira, type PayableRow } from "@/lib/suite-data";

/**
 * Bills between arriving and being paid, each showing its three-way match.
 *
 * The three ticks are the whole reason Admin and Finance are one system. A
 * purchase order is raised in Admin, the goods-received note is signed in
 * Admin, and the bill lands here already matched against both — so the match
 * state is a fact this module reads rather than a reconciliation it performs.
 * Where a leg is missing, that is what is blocking payment, and the status
 * word says the same thing.
 *
 * Each leg is a glyph *and* a word, and the two glyphs differ in shape as well
 * as in colour, so the state survives being printed in greyscale.
 *
 * Nothing here is actionable. There is no Approve button because there is
 * nothing behind it — an inert control shaped like a live one is the fastest
 * way to make a preview read as a mock-up.
 */

const MATCH: Record<PayableRow["matched"], { po: boolean; grn: boolean }> = {
  "PO + GRN": { po: true, grn: true },
  "PO only": { po: true, grn: false },
  Unmatched: { po: false, grn: false },
};

/** Everything between receipt and payment. Paid bills have left the queue. */
const QUEUE = FINANCE_DATA.payables.filter((bill) => bill.status !== "Paid");

const queueTotal = QUEUE.reduce((sum, bill) => sum + bill.amount, 0);

function MatchLeg({ label, ok }: { label: string; ok: boolean }) {
  const Glyph = ok ? CircleCheck : CircleX;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
        ok
          ? "bg-success-500/10 text-success-600"
          : "bg-error-500/10 text-error-600"
      }`}
    >
      <Glyph className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
      <span className="sr-only">{ok ? " matched" : " missing"}</span>
    </span>
  );
}

export function ApprovalQueue() {
  return (
    <div>
      <ul className="divide-y divide-neutral-100">
        {QUEUE.map((bill) => {
          const match = MATCH[bill.matched];

          return (
            <li key={bill.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-neutral-900">
                    {bill.vendor}
                  </p>
                  <p className="text-[11px] text-neutral-500">
                    <span className="tnum">{bill.bill}</span> · due{" "}
                    <span className="tnum">{bill.due}</span>
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-neutral-900 tnum">
                  {naira(bill.amount)}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <MatchLeg label="PO" ok={match.po} />
                <MatchLeg label="GRN" ok={match.grn} />
                {/* The bill itself is the third leg — it is always present. */}
                <MatchLeg label="Invoice" ok />
                <span className="ml-auto">
                  <Pill tone={bill.tone}>{bill.status}</Pill>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-neutral-200 pt-3 text-xs">
        <span className="text-neutral-500">
          <span className="tnum">{QUEUE.length}</span> bills in the queue
        </span>
        <span className="font-semibold text-neutral-900 tnum">
          {naira(queueTotal)}
        </span>
      </p>
    </div>
  );
}
