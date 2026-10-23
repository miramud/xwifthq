import { ShieldCheck } from "lucide-react";

/**
 * Spend to pay, drawn as the sequence it actually is.
 *
 * Numbered because the order is the content: a voucher cannot exist before the
 * finance control unit clears the memo, and a payment is not final until it is
 * confirmed against the bank line. Each stage names who acts, and the stages
 * that are controls carry a shield glyph *and* the word "Control" — gold marks
 * them as a glyph at `accent-600`; the word is ink, so colour never does the
 * work alone.
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
    detail: "Charged to a project or cost centre; funds checked before it can be approved.",
  },
  {
    title: "Finance control unit checkpoints",
    who: "FCU officer",
    detail: "Item-by-item checklist against the memo and its papers.",
    control: true,
  },
  {
    title: "Payment voucher",
    who: "Finance",
    detail: "Gap-free number, withholding tax worked out, accrual posted on approval.",
    control: true,
  },
  {
    title: "Payment schedule and bank file",
    who: "Treasury · second approver",
    detail: "Batched, approved by someone else, exported as the bank's file.",
  },
  {
    title: "Confirmed against the statement",
    who: "FCU officer",
    detail: "Matched to the imported bank line, with charges split out.",
    control: true,
  },
  {
    title: "Retired",
    who: "Requester · Finance",
    detail: "Advances closed with receipts; anything unretired blocks the exit clearance.",
  },
];

export function SpendPipeline() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          From memo to bank line
        </p>
        <p className="label-mono text-neutral-500">Six stages · three controls</p>
      </div>

      <ol className="mt-5 space-y-0">
        {STAGES.map((stage, index) => (
          <li key={stage.title} className="relative flex gap-4 pb-4 last:pb-0">
            {/* The spine between steps. */}
            {index < STAGES.length - 1 && (
              <span
                className="absolute left-[0.9375rem] top-8 bottom-0 w-px bg-neutral-200"
                aria-hidden="true"
              />
            )}
            <span className="tnum label-mono relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50 text-neutral-700">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="text-[13px] font-semibold text-neutral-900">{stage.title}</p>
                {stage.control && (
                  <span className="label-mono inline-flex items-center gap-1 rounded-full border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-neutral-900">
                    <ShieldCheck className="h-3 w-3 text-accent-600" aria-hidden="true" />
                    Control
                  </span>
                )}
              </div>
              <p className="label-mono mt-0.5 text-neutral-500">{stage.who}</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-600">{stage.detail}</p>
            </div>
          </li>
        ))}
      </ol>

      <p className="mt-4 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
        Separation of duties is enforced by the system, not by goodwill: one
        person cannot both raise and approve, or approve and pay, the same
        spend. High-value approvals ask for a second factor from an
        authenticator app.
      </p>
    </div>
  );
}
