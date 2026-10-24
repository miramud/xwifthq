"use client";

import { Circle, CircleAlert, CircleCheck } from "lucide-react";
import { ProgressRing } from "@/components/workspace/charts";
import { CalloutStrip, Chip, cx } from "@/components/workspace/kit";

/**
 * The September close, item by item.
 *
 * `FINANCE_DATA` carries no close checklist, so the items are declared here.
 * Four of the seven are deliberately cross-module (the payroll journal comes
 * from HRM, depreciation runs against Admin's fixed asset register, revenue
 * recognition reads Projects' billable time), because that is what a close
 * looks like when the modules share a ledger instead of exchanging
 * spreadsheets. The figures quoted are the same ones the other modules show.
 *
 * State is a glyph and a word. A filled tick and an empty ring differ in
 * shape, so "done" survives a greyscale print and a colour-blind reader.
 */

interface CloseItem {
  label: string;
  detail: string;
  done: boolean;
}

const ITEMS: readonly CloseItem[] = [
  {
    label: "Supplier statements reconciled",
    detail: "Every trading vendor agreed to its statement for the period.",
    done: true,
  },
  {
    label: "Depreciation run",
    detail: "486 fixed assets, straight line, from the Admin register.",
    done: true,
  },
  {
    label: "Billable time recognised",
    detail: "1,240 hours from Projects, posted against the Meridian contract.",
    done: true,
  },
  {
    label: "Payroll journal posted",
    detail: "JV-2026-09-30 is drafted in HRM and waits on the run approval.",
    done: false,
  },
  {
    label: "Bank reconciliation",
    detail: "6 lines unmatched against the statement.",
    done: false,
  },
  {
    label: "Accruals and prepayments",
    detail: "Utilities and the annual insurance instalment still to raise.",
    done: false,
  },
  {
    label: "Management pack issued",
    detail: "Blocked until the bank reconciliation clears.",
    done: false,
  },
];

const doneCount = ITEMS.filter((item) => item.done).length;
const percent = Math.round((doneCount / ITEMS.length) * 100);

export function PeriodClose() {
  return (
    <div>
      <div className="flex items-center gap-5">
        <ProgressRing value={percent} hue="blue" size={112} label="complete" caption="September close" />
        <div className="min-w-0">
          <p className="text-sm text-neutral-600">
            <span className="text-lg font-bold tabular-nums text-neutral-900">{doneCount}</span> of <span className="tabular-nums">{ITEMS.length}</span> steps complete
          </p>
          <p className="mt-1 text-xs text-neutral-500">{ITEMS.length - doneCount} still to finish before the month locks.</p>
        </div>
      </div>

      <ul className="mt-5 space-y-1">
        {ITEMS.map((item) => {
          const Glyph = item.done ? CircleCheck : Circle;

          return (
            <li key={item.label} className="flex gap-3 rounded-xl px-2 py-2">
              <span
                className={cx(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                  item.done ? "bg-mint-50 text-mint-700" : "bg-neutral-100 text-neutral-500",
                )}
              >
                <Glyph className="h-4 w-4" aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cx("text-sm font-semibold", item.done ? "text-neutral-500 line-through decoration-neutral-300" : "text-neutral-900")}>
                  {item.label} <span className="sr-only">({item.done ? "done" : "outstanding"})</span>
                </p>
                <p className="text-xs leading-relaxed text-neutral-500">{item.detail}</p>
              </div>
              <span className="shrink-0 self-start" aria-hidden="true">
                <Chip hue={item.done ? "mint" : "slate"} className="!py-0.5 !text-[11px]">
                  {item.done ? "Done" : "Open"}
                </Chip>
              </span>
            </li>
          );
        })}
      </ul>

      <CalloutStrip icon={CircleAlert} hue="sun" title="Bank reconciliation is holding up the management pack" className="mt-4">
        Clear the 6 unmatched lines to release it.
      </CalloutStrip>
    </div>
  );
}
