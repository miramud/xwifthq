import { BadgeCheck, Check, MonitorPlay, ScrollText } from "lucide-react";

/**
 * The LMS hero's drawn mock: one assigned pathway, mid-flight.
 *
 * Drawn rather than captured (the product page now leads with the real screen;
 * this mock remains for the preview route) — a path of courses assigned to a team, with a named
 * next step and a certificate at the end of it.
 *
 * On the deep teal hero the tiles are white at low alpha rather than
 * `HUE.primary.tile`, which at 10% teal-on-teal would be invisible. Gold
 * appears once, on the step in progress, because that is what gold means on
 * this site.
 */

type StepState = "done" | "now" | "next";

const STEPS: { title: string; meta: string; state: StepState }[] = [
  { title: "Safeguarding essentials", meta: "Course · complete", state: "done" },
  { title: "Data protection basics", meta: "Course · complete", state: "done" },
  { title: "Reporting standards", meta: "Course · complete", state: "done" },
  { title: "Revenue analytics", meta: "Course · 2 of 5 lessons", state: "now" },
  { title: "Field data quality", meta: "Course · not started", state: "next" },
  { title: "Budget monitoring", meta: "Course · not started", state: "next" },
];

const STATE_TILE: Record<StepState, string> = {
  done: "bg-white/15",
  now: "bg-accent-500",
  next: "bg-white/8",
};

const STATE_GLYPH: Record<StepState, string> = {
  done: "text-white",
  // Ink on gold. White on gold is 2.15:1 and fails, so the one place gold is a
  // fill is also the one place the glyph on it is dark.
  now: "text-neutral-900",
  next: "text-white/70",
};

export function LmsHeroMock() {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-white/15 bg-white/[0.07] p-7 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="font-heading text-lg font-semibold text-white">
            Field Operations pathway
          </p>
          <p className="label-mono mt-1 text-white/70">
            Assigned to a role · 6 courses
          </p>
        </div>
        <span className="label-mono rounded-full bg-white/10 px-3 py-1 text-white/70">
          Illustrative
        </span>
      </div>

      <ol className="mt-6 space-y-2.5">
        {STEPS.map((step) => (
          <li key={step.title} className="flex items-center gap-3">
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${STATE_TILE[step.state]}`}
            >
              {step.state === "done" ? (
                <Check
                  className={`h-4 w-4 ${STATE_GLYPH[step.state]}`}
                  aria-hidden="true"
                />
              ) : (
                <MonitorPlay
                  className={`h-4 w-4 ${STATE_GLYPH[step.state]}`}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-white">
                {step.title}
              </span>
              <span className="label-mono text-white/70">{step.meta}</span>
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-6 flex items-center gap-2.5 border-t border-white/10 pt-5 text-sm text-white/70">
        <BadgeCheck className="h-4 w-4 shrink-0 text-white" aria-hidden="true" />
        Finish the path and the certificate carries a serial
      </p>
      <p className="mt-2 flex items-center gap-2.5 text-sm text-white/70">
        <ScrollText
          className="h-4 w-4 shrink-0 text-white"
          aria-hidden="true"
        />
        Anyone holding it can check it without an account
      </p>
    </div>
  );
}
