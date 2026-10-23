import { Circle, CircleCheck } from "lucide-react";
import { ProgressBar } from "@/components/suite/ui";

/**
 * The September close, item by item.
 *
 * `FINANCE_DATA` carries no close checklist, so the items are declared here.
 * Four of the seven are deliberately cross-module — the payroll journal comes
 * from HRM, depreciation runs against Admin's fixed asset register, revenue
 * recognition reads Projects' billable time — because that is what a close
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
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-neutral-500">
          <span className="font-semibold text-neutral-900 tnum">
            {doneCount}
          </span>{" "}
          of <span className="tnum">{ITEMS.length}</span> complete
        </p>
        <p className="text-xs text-neutral-500 tnum">{percent}%</p>
      </div>
      <ProgressBar value={percent} className="mt-2 w-full" />

      <ul className="mt-4 space-y-3">
        {ITEMS.map((item) => {
          const Glyph = item.done ? CircleCheck : Circle;

          return (
            <li key={item.label} className="flex gap-2.5">
              <Glyph
                className={`mt-0.5 h-4 w-4 shrink-0 ${
                  item.done ? "text-success-600" : "text-neutral-300"
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p
                  className={`text-sm ${
                    item.done
                      ? "font-medium text-neutral-500 line-through decoration-neutral-300"
                      : "font-medium text-neutral-900"
                  }`}
                >
                  {item.label}{" "}
                  <span className="sr-only">
                    ({item.done ? "done" : "outstanding"})
                  </span>
                </p>
                <p className="text-xs leading-relaxed text-neutral-500">
                  {item.detail}
                </p>
              </div>
              <span
                className={`ml-auto shrink-0 self-start text-[10px] font-semibold uppercase tracking-wide ${
                  item.done ? "text-success-600" : "text-neutral-500"
                }`}
                aria-hidden="true"
              >
                {item.done ? "Done" : "Open"}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
