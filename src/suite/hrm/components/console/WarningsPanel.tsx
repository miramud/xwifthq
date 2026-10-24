"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Gavel, ShieldCheck, Lightbulb } from "lucide-react";
import { Chip, Panel } from "@/components/workspace/kit";
import { IconTile } from "../ui/recordKit";
import { hrm, type LiveWarning } from "@/lib/api/hrm-client";
import { formatDate } from "@/suite/hrm/lib/format";

/**
 * What is live on somebody's disciplinary record, and only what is live.
 *
 * The register existed as an endpoint from the day warnings did and had no
 * screen, which meant the one question the ladder depends on, "is there
 * anything already on this person's record?", could only be answered by
 * reading the whole caseload and working out the expiry dates by hand. That is
 * the sort of question people answer from memory instead, and memory does not
 * expire on a date.
 *
 * Three things it is careful about.
 *
 * **Expired warnings are not shown.** A warning that has run its course is
 * spent; showing it greyed out invites somebody to count it anyway, which is
 * the exact thing an expiry date exists to prevent.
 *
 * **A clean record is stated, not implied by absence.** Somebody about to
 * issue a warning needs the difference between "nothing on file" and "this
 * did not load", and a blank panel says both.
 *
 * **The ladder's suggestion is advice and is labelled as advice.** It reads
 * the register and says what normally comes next; it does not know about the
 * mitigation somebody gave at the hearing, and a screen that presents it as
 * the answer makes the hearing decorative.
 */
export default function WarningsPanel({ employeeId }: { employeeId: string }) {
  const [warnings, setWarnings] = useState<LiveWarning[] | null>(null);
  const [nextStep, setNextStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.relations
      .warningsFor(employeeId)
      .then((result) => {
        if (cancelled) return;
        setWarnings(result.data);
        setNextStep(result.meta.suggestedNextStepLabel);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (error !== null) {
    return (
      <Panel title="Disciplinary record" icon={Gavel} hue="coral">
        <p className="flex items-center gap-2 rounded-xl bg-sun-50 px-3 py-2.5 text-sm text-sun-700">
          <AlertTriangle size={15} className="shrink-0" aria-hidden />
          The register did not load, so treat this record as unknown rather than
          clean.
        </p>
      </Panel>
    );
  }

  if (warnings === null) {
    return (
      <div className="ws-card h-32 animate-pulse bg-neutral-50" />
    );
  }

  return (
    <Panel
      title="Disciplinary record"
      icon={Gavel}
      hue="coral"
      subtitle="Live warnings only. Anything past its expiry has stopped counting and is not shown."
      bodyClassName={warnings.length === 0 ? "p-5" : "pt-4"}
    >
      {warnings.length === 0 ? (
        /*
          Said in words. A blank panel reads the same as one that failed to
          load, and the difference matters to somebody deciding an outcome.
        */
        <div className="flex items-center gap-3 rounded-xl bg-mint-50 px-3 py-3">
          <ShieldCheck size={18} className="shrink-0 text-mint-700" aria-hidden />
          <p className="text-sm font-medium text-mint-700">Nothing live on this record.</p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-neutral-100">
            {warnings.map((warning) => (
              <li key={warning.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                <IconTile icon={Gavel} hue="coral" size={36} />

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-neutral-900">
                    {warning.outcomeLabel ?? warning.statusLabel}
                  </p>
                  <p className="truncate text-xs text-neutral-500">
                    {warning.reference} · {warning.summary}
                  </p>
                </div>

                {/*
                  The expiry, not the issue date. What a decision-maker needs is
                  how much longer this counts, and it is the figure people most
                  often get wrong about their own record too.
                */}
                <Chip hue="sun" dot>
                  {warning.daysUntilExpiry === null
                    ? "No expiry set"
                    : `${warning.daysUntilExpiry}d left`}
                </Chip>

                <span className="w-full text-xs text-neutral-500 sm:w-auto">
                  Stops counting {formatDate(warning.expiresOn)}
                </span>
              </li>
            ))}
          </ul>

          {nextStep !== null && (
            <div className="flex items-start gap-2 border-t border-neutral-100 bg-sky-50/60 px-5 py-3">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-sky-700" aria-hidden />
              <p className="text-xs text-neutral-700">
                <span className="font-semibold text-sky-700">Usually next: {nextStep}.</span>{" "}
                Advice from the register, not a decision. It knows what is on
                file and nothing about what was said at the hearing.
              </p>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
