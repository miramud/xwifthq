"use client";

import { CircleCheck, CircleX, ReceiptText } from "lucide-react";
import { Pill } from "@/components/suite/ui";
import { Chip } from "@/components/workspace/kit";
import { IconTile } from "@/suite/lms/components/ui/ws";
import { FINANCE_DATA, naira, type PayableRow } from "@/lib/suite-data";

/**
 * Bills between arriving and being paid, each showing its three-way match.
 *
 * The three ticks are the whole reason Admin and Finance are one system. A
 * purchase order is raised in Admin, the goods-received note is signed in
 * Admin, and the bill lands here already matched against both, so the match
 * state is a fact this module reads rather than a reconciliation it performs.
 * Where a leg is missing, that is what is blocking payment, and the status
 * word says the same thing.
 *
 * Each leg is a glyph and a word, and the two glyphs differ in shape as well
 * as in colour, so the state survives being printed in greyscale.
 *
 * Nothing here is actionable. There is no Approve button because there is
 * nothing behind it: an inert control shaped like a live one is the fastest
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
  return (
    <Chip hue={ok ? "mint" : "rose"} icon={ok ? CircleCheck : CircleX} className="!px-2 !py-0.5 !text-[11px]">
      {label}
      <span className="sr-only">{ok ? " matched" : " missing"}</span>
    </Chip>
  );
}

export function ApprovalQueue() {
  return (
    <div>
      <ul className="space-y-1">
        {QUEUE.map((bill) => {
          const match = MATCH[bill.matched];

          return (
            <li key={bill.id} className="rounded-2xl px-2 py-3 transition-colors hover:bg-neutral-50">
              <div className="flex items-start gap-3">
                <IconTile icon={ReceiptText} hue="coral" size={38} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">{bill.vendor}</p>
                  <p className="text-xs text-neutral-500">
                    <span className="tabular-nums">{bill.bill}</span> · due <span className="tabular-nums">{bill.due}</span>
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold tabular-nums text-neutral-900">{naira(bill.amount)}</p>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-[50px]">
                <MatchLeg label="PO" ok={match.po} />
                <MatchLeg label="GRN" ok={match.grn} />
                {/* The bill itself is the third leg, so it is always present. */}
                <MatchLeg label="Invoice" ok />
                <span className="ml-auto">
                  <Pill tone={bill.tone}>{bill.status}</Pill>
                </span>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 flex flex-wrap items-baseline justify-between gap-2 rounded-2xl bg-primary-50 px-4 py-3 text-xs">
        <span className="text-primary-700">
          <span className="font-semibold tabular-nums">{QUEUE.length}</span> bills in the queue
        </span>
        <span className="text-sm font-bold tabular-nums text-neutral-900">{naira(queueTotal)}</span>
      </p>
    </div>
  );
}
