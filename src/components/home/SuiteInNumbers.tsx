import Image from "next/image";
import Link from "next/link";
import { MessagesSquare } from "lucide-react";

import { SectionIntro } from "@/components/home/SectionIntro";

/**
 * Six figures about the platform, in the template's fun-fact frame.
 *
 * Every one of them is a capability that can be checked on this site — the
 * number of modules, the number of approval models, the number of audit trails.
 * None of them is an adoption or revenue figure, because a number nobody can
 * attribute is worth less than a fact the reader can verify a scroll away. The
 * footnote says so rather than leaving the reader to guess.
 *
 * The template pairs its counters with a photograph and floats a "free call"
 * box over its corner. The photograph and the box are kept; the box points at
 * support rather than quoting a phone number, because a number printed on a
 * home page is a number somebody has to answer.
 *
 * Values carry `.tnum` so a grid of them lines up on the digit instead of
 * shuffling by a pixel per glyph.
 */

const FIGURES = [
  {
    value: "5",
    label: "Modules, all live",
    note: "Finance, Admin & Operations, HR, Projects and Learning.",
  },
  {
    value: "1",
    label: "Sign-in",
    note: "A person is created once and every module inherits them.",
  },
  {
    value: "1",
    label: "Approval engine",
    note: "Your levels and amount bands, one inbox, delegation when someone is away.",
  },
  {
    value: "1",
    label: "Set of books",
    note: "Payroll, purchases, trips and project spend post to the same ledger.",
  },
  {
    value: "4",
    label: "Financial statements",
    note: "Trial balance, income statement, financial position and cash flow.",
  },
  {
    value: "5",
    label: "Cross-module flows",
    note: "Named end to end, from a purchase request to the bank file.",
  },
] as const;

export function SuiteInNumbers() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <SectionIntro
          eyebrow="In numbers"
          title="Numbers and facts that define the platform."
          intro="These are capability figures, not customer figures. Each one is a claim about how the platform is built, and each one is checkable on this site."
        />

        <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-14">
          <div className="relative">
            <div className="relative h-80 overflow-hidden rounded-2xl sm:h-[26rem] lg:h-full lg:min-h-[30rem]">
              <Image
                src="/images/planning.jpg"
                alt="A team at work in an open-plan office, one of them holding a laptop"
                fill
                sizes="(min-width: 1024px) 46vw, 100vw"
                className="object-cover"
              />
            </div>

            {/* The call box. */}
            <Link
              href="/support"
              className="group absolute -bottom-6 left-4 flex max-w-xs items-center gap-4 rounded-2xl bg-primary-600 p-5 shadow-xl transition-colors duration-200 hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:left-8 sm:p-6"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/15">
                <MessagesSquare
                  className="h-5 w-5 text-white"
                  aria-hidden="true"
                />
              </span>
              <span>
                <span className="label-mono block text-white/70">
                  Questions first?
                </span>
                <span className="mt-1 block font-heading text-lg font-semibold text-white">
                  Talk to the team
                </span>
              </span>
            </Link>
          </div>

          <dl className="grid gap-x-10 border-t border-dashed border-neutral-300 pt-2 sm:grid-cols-2">
            {FIGURES.map((figure) => (
              <div
                key={figure.label}
                className="border-b border-dashed border-neutral-300 py-6"
              >
                <dt className="label-mono text-primary-600">{figure.label}</dt>
                <dd>
                  <span className="tnum mt-2 block font-heading text-4xl font-bold leading-none text-neutral-900">
                    {figure.value}
                  </span>
                  <span className="mt-3 block text-sm leading-relaxed text-neutral-600">
                    {figure.note}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-14 max-w-2xl text-sm leading-relaxed text-neutral-500 sm:mt-16">
          Every figure above describes how the platform is built rather than how
          many people use it. Where a customer number belongs on this site, it
          appears on the page that can source it.
        </p>
      </div>
    </section>
  );
}
