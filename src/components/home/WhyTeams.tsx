import { Plus } from "lucide-react";

import { SectionHeading } from "@/components/site/SectionHeading";

/**
 * Four figures in staggered glow cards. Every one is a fact about how the
 * product is built, checkable on this site, never an adoption number nobody
 * can source.
 */

const FIGURES = [
  { value: "5", label: "Modules that work as one: finance, operations, people, projects and learning." },
  { value: "1", label: "Login for every person. Add someone once and every module knows them." },
  { value: "1", label: "Approvals inbox for leave, purchases, payments and budgets alike." },
  { value: "1", label: "Set of books. Payroll, purchases, trips and projects all post to it." },
];

export function WhyTeams() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <SectionHeading
          title="Why teams switch to XwiftHQ"
          intro="Fewer tools, fewer spreadsheets and fewer emails asking where something is. Here is what sits underneath."
        />

        <dl className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-start">
          {FIGURES.map((figure, i) => (
            <div
              key={figure.label}
              className={`flex min-h-56 flex-col justify-between p-6 ${
                i % 2 === 0 ? "xw-glow-card lg:min-h-64" : "xw-tile lg:mt-8"
              }`}
            >
              <div className="flex items-start justify-between">
                <dt className="sr-only">{figure.label}</dt>
                <dd className="tnum font-heading text-5xl font-bold tracking-[-0.04em] text-neutral-900">
                  {figure.value}
                </dd>
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-600 text-white" aria-hidden="true">
                  <Plus className="h-3.5 w-3.5" />
                </span>
              </div>
              <p className="mt-10 text-sm leading-relaxed text-neutral-600" aria-hidden="true">
                {figure.label}
              </p>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
