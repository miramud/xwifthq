import { Check, ChevronRight } from "lucide-react";

/**
 * Document, then acknowledgement, then calendar, then evidence.
 *
 * Four pale tiles inside a white frame, each naming the screen where the step
 * happens and carrying its number in a purple circle. Every step happens in
 * the same module, so the module hue stays out of it.
 *
 * A real `<ol>`: the order is the argument, so the markup carries it, and the
 * chevrons between tiles are decoration on top of numbering that already
 * exists. Below `sm` the chevrons go and the numbered circles do the work.
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
      "Every policy, procedure or form is approved before it goes out, and versioned when it changes.",
    meta: "v3.2 · approved",
  },
  {
    where: "My policies",
    number: "02",
    title: "Acknowledged by everyone it covers",
    detail:
      "Each person reads and signs off on the version that applies to them.",
    meta: "Per person, per version",
  },
  {
    where: "Compliance calendar",
    number: "03",
    title: "Renewals you cannot miss",
    detail:
      "Licences, permits, insurances and vehicle papers carry due dates, with an alert every morning until they are renewed.",
    meta: "Daily alerts",
  },
  {
    where: "Bid pack",
    number: "04",
    title: "Evidence on demand",
    detail:
      "Current certificates download as one ZIP, and the audit log records who, which version and when.",
    meta: "One shared trail",
  },
];

export function PolicyEvidenceChain() {
  return (
    <div className="xw-frame p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Policy to evidence
        </p>
        <p className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
          One module, one trail
        </p>
      </div>

      <ol className="mt-5 grid gap-4 sm:grid-cols-2">
        {STEPS.map((step, index) => {
          return (
            <li key={step.number} className="relative min-w-0">
              <div className="xw-tile h-full p-4">
                <div className="flex items-center gap-3">
                  <span
                    className="tnum flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[11px] font-semibold text-white"
                    aria-hidden="true"
                  >
                    {step.number}
                  </span>
                  <span className="min-w-0 truncate text-xs font-medium text-neutral-500">
                    {step.where}
                  </span>
                </div>

                <h4 className="mt-3 font-heading text-sm font-semibold text-neutral-900">
                  {step.title}
                </h4>
                <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
                  {step.detail}
                </p>
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700">
                  <Check className="h-3 w-3 text-primary-700" aria-hidden="true" />
                  {step.meta}
                </p>
              </div>

              {index < STEPS.length - 1 && index % 2 === 0 && (
                <ChevronRight
                  className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-white text-primary-400 sm:block"
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      <p className="mt-5 rounded-2xl bg-primary-50 px-4 py-3 text-xs leading-relaxed text-primary-900">
        No more chasing signatures. Your evidence is a dated acknowledgement
        against a specific version, which is exactly what the auditor asked for
        in the first place.
      </p>
    </div>
  );
}
