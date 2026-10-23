import { ChevronRight } from "lucide-react";

/**
 * Document → acknowledgement → calendar → evidence.
 *
 * Drawn in ink alone, like the rest of the Admin & Operations page: every step
 * happens in the same module, so a hue would tell the reader nothing. Each
 * card names the screen where the step happens instead.
 *
 * A real `<ol>`: the order is the argument, so the markup carries it, and the
 * chevrons between cards are decoration on top of numbering that already
 * exists. Below `sm` the chevrons go and the mono step numbers do the work.
 */

interface Step {
  where: string;
  number: string;
  title: string;
  detail: string;
  meta: string;
}

const STEPS: readonly Step[] = [
  {
    where: "Controlled documents",
    number: "01",
    title: "Approved, then issued",
    detail:
      "A policy, procedure or form is approved before it is issued, and versioned when it changes.",
    meta: "v3.2 · approved",
  },
  {
    where: "My policies",
    number: "02",
    title: "Acknowledged by the people it covers",
    detail:
      "Each person reads and acknowledges the version that applies to them.",
    meta: "Per person, per version",
  },
  {
    where: "Compliance calendar",
    number: "03",
    title: "Renewals that cannot be missed",
    detail:
      "Licences, permits, insurances and vehicle papers carry due dates, with alerts every morning until they are renewed.",
    meta: "Daily alerts",
  },
  {
    where: "Bid pack",
    number: "04",
    title: "Evidence on demand",
    detail:
      "The current certificates download as one ZIP, and the audit log keeps who, which version and when.",
    meta: "One shared trail",
  },
];

export function PolicyEvidenceChain() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Policy to evidence
        </p>
        <p className="label-mono text-neutral-500">One module, one trail</p>
      </div>

      <ol className="mt-5 grid gap-4 sm:grid-cols-2">
        {STEPS.map((step, index) => {
          return (
            <li key={step.number} className="relative min-w-0">
              <div className="h-full rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <div className="flex items-center gap-3">
                  <span className="label-mono min-w-0 truncate text-neutral-500">
                    {step.where}
                  </span>
                  <span className="tnum label-mono ml-auto shrink-0 text-neutral-500">
                    {step.number}
                  </span>
                </div>

                <h4 className="mt-3 font-heading text-sm font-semibold text-neutral-900">
                  {step.title}
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
                  {step.detail}
                </p>
                <p className="label-mono mt-3 border-t border-neutral-200 pt-2.5 text-neutral-500">
                  {step.meta}
                </p>
              </div>

              {index < STEPS.length - 1 && index % 2 === 0 && (
                <ChevronRight
                  className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-neutral-300 sm:block"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-5 border-t border-neutral-200 pt-4 text-xs leading-relaxed text-neutral-500">
        Nobody chases a signature. The evidence is an acknowledgement with a
        date against a version, which is what an auditor asked for in the first
        place.
      </p>
    </div>
  );
}
