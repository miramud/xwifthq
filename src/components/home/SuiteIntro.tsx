import Image from "next/image";

import { PillLink } from "@/components/home/PillLink";
import { SectionIntro } from "@/components/home/SectionIntro";

/**
 * "One suite" — the template's about block.
 *
 * The template's arrangement is a split heading over a two-column body: a tall
 * portrait image on the left, and on the right a counter sitting in its own
 * panel beside the prose.
 *
 * The strip that closes the section names the five modules and what each one
 * runs. All five are live (owner, 9 October 2026), so the strip no longer
 * sorts them into "now" and "later" — it says what each covers instead, in
 * the company-first order the registry uses.
 */

const MODULES = [
  { name: "Finance", scope: "Ledger, spend, revenue, budgets" },
  { name: "Admin & Operations", scope: "Buying, travel, assets, fleet" },
  { name: "People (HR)", scope: "Hire, pay, perform, exit" },
  { name: "Projects", scope: "Plan, test, deliver, cost" },
  { name: "Learning", scope: "Staff training and compliance" },
] as const;

export function SuiteIntro() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <SectionIntro
          eyebrow="One suite"
          align="split"
          title={
            <>
              One place to run the money, the operations, the people and the
              work — on the same records.
            </>
          }
        />

        <div className="mt-12 grid items-stretch gap-8 lg:mt-14 lg:grid-cols-12 lg:gap-10">
          <div className="relative min-h-72 overflow-hidden rounded-2xl lg:col-span-4">
            <Image
              src="/images/2151964106.jpg"
              alt="An analyst working through a wall-mounted dashboard of company figures"
              fill
              sizes="(min-width: 1024px) 32vw, 100vw"
              className="object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-primary-900/65 to-transparent"
              aria-hidden="true"
            />
            <p className="label-mono absolute inset-x-5 bottom-5 text-white/85">
              One dataset, five modules
            </p>
          </div>

          <div className="grid gap-8 lg:col-span-8 lg:grid-cols-5 lg:gap-10">
            {/*
              The counter panel. Mist on white and a dashed edge, which is the
              template's way of marking a figure as a figure without giving it
              a shadow and floating it off the page.
            */}
            <div className="flex flex-col justify-center rounded-2xl border border-dashed border-neutral-300 bg-neutral-100 p-7 lg:col-span-2">
              <p className="tnum font-heading text-6xl font-bold leading-none text-neutral-900">
                5
                <span className="align-top text-3xl text-primary-600">+</span>
              </p>
              <p className="mt-4 text-base leading-relaxed text-neutral-600">
                Modules on one sign-in, one organisation structure, one
                approval engine and one audit trail.
              </p>
            </div>

            <div className="flex flex-col justify-center lg:col-span-3">
              <p className="text-lg leading-relaxed text-neutral-600">
                Most companies run their accounts, purchasing, HR, projects and
                training in five tools that don&apos;t know each other — and
                spend month-end reconciling them. Elevate puts them on one
                spine: a person is added once, every request goes through one
                approval engine, payroll and purchases post to the same books,
                and every change lands in one audit trail.
              </p>

              <div className="mt-8">
                <PillLink href="/platform" label="How the spine works" />
              </div>
            </div>
          </div>
        </div>

        {/* The five modules and what each one runs. */}
        <div className="mt-14 border-t border-dashed border-neutral-300 pt-10 sm:mt-16">
          <p className="label-mono text-neutral-500">The modules</p>
          <ul className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-5">
            {MODULES.map((module) => (
              <li key={module.name} className="flex flex-col gap-1.5">
                <span className="font-heading text-lg font-semibold leading-snug text-neutral-900 sm:text-xl">
                  {module.name}
                </span>
                <span className="text-sm leading-snug text-neutral-600">
                  {module.scope}
                </span>
                <span className="label-mono inline-flex items-center gap-1.5 text-primary-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-600" aria-hidden="true" />
                  Live
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
