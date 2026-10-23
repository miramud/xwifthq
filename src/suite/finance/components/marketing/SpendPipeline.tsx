import { ShieldCheck } from "lucide-react";

/**
 * Spend to pay, drawn as the sequence it actually is.
 *
 * Numbered because the order is the content: a voucher cannot exist before the
 * finance control unit clears the memo, and a payment is not final until it is
 * confirmed against the bank line. Each stage names who acts. The stages that
 * are controls carry a shield glyph and the word "Control" on a lilac pill, so
 * colour never does the work alone. Step numbers sit in purple circles on a
 * soft lilac spine.
 */

interface Stage {
  title: string;
  who: string;
  detail: string;
  control?: boolean;
}

const STAGES: readonly Stage[] = [
  {
    title: "Payment or advance memo",
    who: "Requester · line approver",
    detail: "Charged to a project or cost centre, with funds checked before approval.",
  },
  {
    title: "Finance control unit checkpoints",
    who: "FCU officer",
    detail: "An item-by-item checklist against the memo and its papers.",
    control: true,
  },
  {
    title: "Payment voucher",
    who: "Finance",
    detail: "Gap-free number, withholding tax worked out, and the accrual posted on approval.",
    control: true,
  },
  {
    title: "Payment schedule and bank file",
    who: "Treasury · second approver",
    detail: "Batched, approved by someone else, and exported in your bank's file format.",
  },
  {
    title: "Confirmed against the statement",
    who: "FCU officer",
    detail: "Matched to the imported bank line, with bank charges split out.",
    control: true,
  },
  {
    title: "Retired",
    who: "Requester · Finance",
    detail: "Advances closed with receipts. Anything unretired blocks exit clearance.",
  },
];

export function SpendPipeline() {
  return (
    <div className="xw-frame p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div>
          <p className="text-[11px] text-neutral-500">Spend to pay</p>
          <p className="font-heading text-sm font-bold text-neutral-900">
            From memo to bank line
          </p>
        </div>
        <span className="rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-medium text-neutral-600">
          Six stages · three controls
        </span>
      </div>

      <ol className="mt-5">
        {STAGES.map((stage, index) => (
          <li key={stage.title} className="relative flex gap-3.5 pb-4 last:pb-0">
            {/* The spine between steps. */}
            {index < STAGES.length - 1 && (
              <span
                className="absolute bottom-0 left-[0.9375rem] top-8 w-0.5 rounded-full bg-primary-100"
                aria-hidden="true"
              />
            )}
            <span className="tnum relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 font-heading text-xs font-bold text-white">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[13px] font-semibold text-neutral-900">{stage.title}</p>
                {stage.control && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-[10px] font-semibold text-primary-700">
                    <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                    Control
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-neutral-500">{stage.who}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-5 rounded-2xl bg-neutral-50 p-4 text-xs leading-relaxed text-neutral-600">
        Separation of duties is enforced by the system, not left to goodwill.
        Nobody can both raise and approve, or approve and pay, the same spend.
        High-value approvals also ask for a second factor from an
        authenticator app.
      </p>
    </div>
  );
}
