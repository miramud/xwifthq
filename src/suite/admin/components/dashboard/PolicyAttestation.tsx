import Link from "next/link";
import { ArrowRight, GraduationCap, ScrollText, Signature } from "lucide-react";
import { ProgressBar, SectionCard } from "@/components/suite/ui";
import { ADMIN_DATA } from "@/lib/suite-data";

/**
 * Policy → evidence, drawn as the three records it actually is.
 *
 * This is the fifth cross-module flow made concrete: Admin publishes the
 * policy, the LMS turns it into an acknowledgement course, HRM holds who
 * attested, and the shared audit log is the evidence. Three steps, three
 * modules, one record — which is the whole suite argument in one card.
 *
 * The headcount is derived from the fixture's attested percentage against the
 * 210 people HRM's launcher summary reports, so the two figures on the two
 * screens cannot drift.
 */

const HEADCOUNT = 210;

/* The open attestation is the one worth showing: a policy nobody has to sign
   is not evidence of anything. */
const POLICY =
  ADMIN_DATA.compliance.find((row) => row.status === "Attestation open") ??
  ADMIN_DATA.compliance[0];

const STEPS = [
  {
    icon: ScrollText,
    module: "Elevate Admin",
    line: `${POLICY.policy} published, effective 1 October`,
  },
  {
    icon: GraduationCap,
    module: "Elevate LMS",
    line: "Issued as an acknowledgement course across all four locations",
  },
  {
    icon: Signature,
    module: "Elevate HRM",
    line: "Attestation written to the employee record, with a date",
  },
];

export function PolicyAttestation() {
  const attested = Math.round((POLICY.acknowledged / 100) * HEADCOUNT);

  return (
    <SectionCard title="Policy attestation" subtitle="Policy → evidence">
      <ol className="space-y-0">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const last = index === STEPS.length - 1;

          return (
            <li key={step.module} className="relative flex gap-3 pb-4 last:pb-0">
              {!last && (
                <span
                  className="absolute left-[15px] bottom-0 top-8 w-px bg-neutral-200"
                  aria-hidden="true"
                />
              )}
              <span className="relative z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-neutral-900/8">
                <Icon className="h-4 w-4 text-neutral-700" aria-hidden="true" />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="label-mono text-neutral-500">{step.module}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-neutral-700">
                  {step.line}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-4 border-t border-neutral-100 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-medium text-neutral-900">Attested</p>
          <p className="font-heading text-base font-bold text-neutral-900 tnum">
            {POLICY.acknowledged}%
          </p>
        </div>
        <ProgressBar value={POLICY.acknowledged} tone="bg-neutral-700" className="mt-2 w-full" />
        <p className="mt-2 text-xs text-neutral-500 tnum">
          {attested} of {HEADCOUNT} staff · {HEADCOUNT - attested} outstanding
        </p>

        <Link
          href="/suite/org/policies"
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary-700 transition-colors hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          Open the course in the LMS console
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </SectionCard>
  );
}
