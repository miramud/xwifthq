import Image from "next/image";
import { Boxes, ShieldCheck, Landmark } from "lucide-react";

import { SectionIntro } from "@/components/home/SectionIntro";

/**
 * "Why Elevate" — the template's choose block.
 *
 * Its shape is the reason it is here: a photograph bled to the viewport edge on
 * one side, and on the other a column of reasons separated by dashed rules
 * rather than boxed into cards. Three claims in three cards read as a feature
 * list; three claims stacked on hairlines read as a position, which is what
 * these three are.
 *
 * On the left the image runs to the edge of the screen with no container, which
 * is the template's one full-bleed move on a light ground. Below `lg` the two
 * columns stack and the image takes a fixed height — a half-height photograph
 * above the text is the arrangement that survives a phone, and a square one
 * pushes the first reason a full screen down.
 *
 * Each reason is a thing the reader can go and check, and every one of them is
 * checkable from this site. That is the standard the rest of the page holds
 * itself to, and this section is where it is stated.
 */

const REASONS = [
  {
    icon: Boxes,
    title: "A suite, not a shared login",
    body: "Five modules read the same people, the same units and cost centres and the same approval workflows. A reorganisation happens once. An approval band is changed once. Nothing is exported from one module to be imported by the next.",
  },
  {
    icon: Landmark,
    title: "Every cost lands in one set of books",
    body: "Payroll, purchases, trips, events and project spend all post to the same ledger, against budgets that warn or block before money is committed. Month-end is a review, and the company finance report prints down to who raised each request.",
  },
  {
    icon: ShieldCheck,
    title: "Isolation enforced in the API",
    body: "Every record in every module is scoped to your organisation, and that boundary lives in the API rather than in the interface. Your people, records and audit trail are reachable by your organisation and no other — and the roles you define are visible to you alone.",
  },
] as const;

export function WhyElevate() {
  return (
    <section className="bg-neutral-100">
      <div className="grid lg:grid-cols-2">
        <div className="relative h-72 sm:h-96 lg:h-auto lg:min-h-[42rem]">
          <Image
            src="/images/2150917182.jpg"
            alt="Four colleagues from a leadership team standing together in an office atrium"
            fill
            sizes="(min-width: 1024px) 50vw, 100vw"
            className="object-cover"
          />
          <div
            className="absolute inset-0 bg-primary-900/25 mix-blend-multiply"
            aria-hidden="true"
          />
        </div>

        <div className="section-padding">
          <div className="mx-auto w-full max-w-2xl px-4 sm:px-6 lg:px-12">
            <SectionIntro
              eyebrow="Why Elevate"
              align="start"
              title="One company, one set of records, and a boundary you can point at."
            />

            <ul className="mt-10 border-y border-dashed border-neutral-300">
              {REASONS.map((reason, index) => (
                <li
                  key={reason.title}
                  className={`flex items-start gap-5 py-7 ${
                    index === REASONS.length - 1
                      ? ""
                      : "border-b border-dashed border-neutral-300"
                  }`}
                >
                  <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm">
                    <reason.icon
                      className="h-6 w-6 text-primary-600"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <h3 className="font-heading text-xl font-semibold text-neutral-900">
                      {reason.title}
                    </h3>
                    <p className="mt-2 text-base leading-relaxed text-neutral-600">
                      {reason.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
