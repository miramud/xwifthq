import Image from "next/image";
import { Check, FileSpreadsheet, Mail, MessageCircle } from "lucide-react";
import { SectionHeader } from "@/components/platform/SectionHeader";

/**
 * The case: in most companies, finance is where every other system's truth
 * arrives late.
 *
 * The aside makes the argument at a glance: three things that normally reach
 * the ledger as attachments, each on a round white icon, inside a white glow
 * card. The closing line sits on a lilac wash with the purple check, so the
 * answer reads as the resolution of the list above it.
 */

const LATE_ARRIVALS = [
  {
    icon: FileSpreadsheet,
    source: "Payroll",
    arrives: "A spreadsheet, sent over after the run",
  },
  {
    icon: Mail,
    source: "The purchase",
    arrives: "An email thread, plus an invoice nobody matched",
  },
  {
    icon: MessageCircle,
    source: "The trip advance",
    arrives: "A WhatsApp message, never retired",
  },
];

export function FinanceCase() {
  return (
    <>
      <SectionHeader
        eyebrow="The case"
        title="Finance hears about everything last"
        align="left"
        hue="accent"
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
        <div className="max-w-prose space-y-4 text-lg leading-relaxed text-neutral-600">
          <p>
            In most companies, the ledger is the last system to hear about
            anything. Payroll turns up as a spreadsheet after the run. A
            purchase turns up as an email thread with an invoice attached. A
            trip advance is agreed on WhatsApp and never retired. None of it is
            quite wrong. It is late, retyped, and one typo away from wrong. And
            nobody can tell you today what a single project has actually cost.
          </p>
          <p>
            Run people, projects, purchasing and the books in one suite and
            nothing arrives late, because nothing ever lived anywhere else. HRM
            posts the payroll journal by cost centre. A purchase, trip or
            workshop approved in Admin &amp; Operations is committed against the
            project&apos;s funds the moment it is approved. Every payment moves
            from memo to control checkpoint to voucher to bank file, then is
            confirmed against the statement line.
          </p>
          <p>
            So the audit trail leads back to the action behind each entry, not
            the person who typed it in. And every project&apos;s expected spend
            sits right beside what it actually spent.{" "}
            <span className="font-semibold text-neutral-900">
              Stop reconciling your ledger. Start reading it.
            </span>
          </p>
        </div>

        <aside className="flex min-w-0 flex-col gap-5">
          <div className="aspect-[16/10] overflow-hidden rounded-[1.25rem] border border-neutral-200">
            <Image
              src="/images/finance-2.jpg"
              alt="A finance team reviewing revenue and expense dashboards on a large screen in a meeting room"
              width={800}
              height={500}
              sizes="(min-width: 1024px) 32vw, 90vw"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="xw-glow-card p-6">
            <h3 className="xw-h3 text-base">What normally arrives late</h3>

            <ul className="mt-5 space-y-3">
              {LATE_ARRIVALS.map((arrival) => {
                const Glyph = arrival.icon;
                return (
                  <li
                    key={arrival.source}
                    className="flex items-start gap-3 rounded-2xl bg-neutral-50 p-3"
                  >
                    <span
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]"
                      aria-hidden="true"
                    >
                      <Glyph className="h-4 w-4 text-neutral-500" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-neutral-900">
                        {arrival.source}
                      </span>
                      <span className="block text-sm text-neutral-500">
                        {arrival.arrives}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>

            <p className="mt-5 flex items-start gap-3 rounded-2xl bg-primary-50 p-4 text-sm leading-relaxed text-neutral-700">
              <span
                className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100"
                aria-hidden="true"
              >
                <Check className="h-3 w-3 text-primary-700" />
              </span>
              In XwiftHQ, each one becomes an entry the moment it happens,
              written by the module that took the action, against the project
              it serves.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
