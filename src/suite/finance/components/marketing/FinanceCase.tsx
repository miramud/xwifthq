import Image from "next/image";
import { FileSpreadsheet, Mail, MessageCircle } from "lucide-react";
import { SectionHeader } from "@/components/platform/SectionHeader";

/**
 * The case: in most companies, finance is where every other system's truth
 * arrives late.
 *
 * The aside is the argument in one glance — three things that normally reach
 * the ledger as attachments, and the one line that says what replaces them. It
 * sits in ink and mist; the single gold rule under the closing line is the only
 * hue in the section, which is as much as a prose block should ever carry.
 */

const LATE_ARRIVALS = [
  {
    icon: FileSpreadsheet,
    source: "Payroll",
    arrives: "A spreadsheet, after the run",
  },
  {
    icon: Mail,
    source: "The purchase",
    arrives: "An email thread, and an invoice nobody matched",
  },
  {
    icon: MessageCircle,
    source: "The trip advance",
    arrives: "A message on WhatsApp — and never retired",
  },
];

export function FinanceCase() {
  return (
    <>
      <SectionHeader
        eyebrow="The case"
        title="Finance is where everything else arrives late"
        align="left"
        hue="accent"
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-14">
        <div className="max-w-prose space-y-4 text-lg leading-relaxed text-neutral-600">
          <p>
            In most companies the ledger is the last system to hear about
            anything. Payroll arrives as a spreadsheet after the run. A purchase
            arrives as an email thread with an invoice attached. A trip advance
            is agreed on WhatsApp and never retired. None of it is wrong,
            exactly — it is late, retyped, and one transcription away from being
            wrong. And nobody can say, today, what any single project has
            actually cost.
          </p>
          <p>
            When people, projects, purchasing and the books run in one suite,
            none of it arrives late, because it was never elsewhere. HRM posts
            the payroll journal by cost centre. A purchase, trip or workshop
            approved in Admin &amp; Operations commits against the project&apos;s
            funds the moment it is approved. Every payment goes memo, control
            checkpoint, voucher, bank file, then confirmation against the
            statement line.
          </p>
          <p>
            So the audit trail runs back to the action that caused the entry,
            not to the person who keyed it in — and every project&apos;s expected
            expense sits next to what it really spent.{" "}
            <span className="font-semibold text-neutral-900">
              That is the difference between a ledger you reconcile and a ledger
              you read.
            </span>
          </p>
        </div>

        <aside className="flex flex-col gap-6">
          <div className="aspect-[16/10] overflow-hidden rounded-2xl border border-neutral-200 shadow-sm">
            <Image
              src="/images/finance-2.jpg"
              alt="A finance team reviewing revenue and expense dashboards on a large screen in a meeting room"
              width={800}
              height={500}
              sizes="(min-width: 1024px) 32vw, 90vw"
              className="h-full w-full object-cover"
            />
          </div>

          <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h3 className="label-mono text-neutral-500">
            What normally arrives late
          </h3>

          <ul className="mt-5 divide-y divide-neutral-200 border-y border-neutral-200">
            {LATE_ARRIVALS.map((arrival) => {
              const Glyph = arrival.icon;
              return (
                <li
                  key={arrival.source}
                  className="flex items-start gap-3 py-3.5"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-100">
                    <Glyph
                      className="h-4 w-4 text-neutral-500"
                      aria-hidden="true"
                    />
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

          <p className="mt-5 flex items-start gap-3 text-sm leading-relaxed text-neutral-700">
            <span
              className="mt-2 h-0.5 w-7 shrink-0 rounded-full bg-accent-500"
              aria-hidden="true"
            />
            In Elevate, each of these is an entry made at the moment of the
            action — by the module that took it, against the project it serves.
          </p>
          </div>
        </aside>
      </div>
    </>
  );
}
