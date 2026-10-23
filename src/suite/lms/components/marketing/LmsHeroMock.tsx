import { BadgeCheck, Check, MonitorPlay, ScrollText } from "lucide-react";

/**
 * The LMS drawn mock: one assigned pathway, mid-flight.
 *
 * Drawn rather than captured (the product page leads with the real screen;
 * this mock stays for the preview route). It shows a path of courses assigned
 * to a team, with a named next step and a certificate at the end of it.
 *
 * It carries its own purple gradient card, so it reads the same on the pale
 * preview panel as anywhere else. The step circles are white at low alpha on
 * that purple; gold appears once, on the step in progress, as the one small
 * accent.
 */

type StepState = "done" | "now" | "next";

const STEPS: { title: string; meta: string; state: StepState }[] = [
  { title: "Safeguarding essentials", meta: "Complete", state: "done" },
  { title: "Data protection basics", meta: "Complete", state: "done" },
  { title: "Reporting standards", meta: "Complete", state: "done" },
  { title: "Revenue analytics", meta: "2 of 5 lessons done", state: "now" },
  { title: "Field data quality", meta: "Not started", state: "next" },
  { title: "Budget monitoring", meta: "Not started", state: "next" },
];

const STATE_TILE: Record<StepState, string> = {
  done: "bg-white text-primary-700",
  now: "bg-accent-500 text-neutral-900",
  next: "bg-white/15 text-white/75",
};

export function LmsHeroMock() {
  return (
    <div
      className="relative mx-auto max-w-md overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 p-6 text-white shadow-[0_40px_80px_-36px_rgb(150_56_205/0.6)] sm:p-7"
      aria-hidden="true"
    >
      <span className="xw-cloud -right-12 -top-8 h-28 w-64 opacity-25" />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-heading text-lg font-bold tracking-[-0.01em]">
            Field Operations pathway
          </p>
          <p className="mt-1 text-xs text-white/75">
            Assigned to a role, 6 courses
          </p>
        </div>
        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white">
          Example
        </span>
      </div>

      <ol className="relative mt-6 space-y-2">
        {STEPS.map((step) => (
          <li
            key={step.title}
            className={`flex items-center gap-3 rounded-2xl px-2.5 py-2 ${
              step.state === "now" ? "bg-white/15 ring-1 ring-white/25" : ""
            }`}
          >
            <span
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${STATE_TILE[step.state]}`}
            >
              {step.state === "done" ? (
                <Check className="h-4 w-4" />
              ) : (
                <MonitorPlay className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">
                {step.title}
              </span>
              <span className="block truncate text-[11px] text-white/75">
                {step.meta}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="relative mt-6 space-y-2 rounded-2xl bg-white p-4 text-sm text-neutral-700">
        <p className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100">
            <BadgeCheck className="h-3.5 w-3.5 text-primary-700" />
          </span>
          Finish the path, earn a numbered certificate
        </p>
        <p className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100">
            <ScrollText className="h-3.5 w-3.5 text-primary-700" />
          </span>
          Anyone can check it, no account needed
        </p>
      </div>
    </div>
  );
}
