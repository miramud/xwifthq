/**
 * How an organisation actually arrives at a suite.
 *
 * Four steps from sign-up to running the company on the suite. All five
 * modules are live (owner, 9 October 2026), so the path no longer stages them
 * by availability: it stages the set-up a company actually does — structure
 * first, then modules, then people, then day-to-day running.
 *
 * The connector is drawn per step and only for the steps that have a successor,
 * so it can never overhang the last one and promise a fifth. Each segment runs
 * from its own marker to the next marker's edge — the gap it crosses is the
 * grid gap, which is why the offsets are stated in the same units.
 */

interface Step {
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    title: "Set up the company once",
    body: "Units, cost centres, job titles, roles and approval workflows go into the organisation console. Every module you switch on reads them from there.",
  },
  {
    title: "Switch on the modules",
    body: "All five, or the ones that hurt most first — often Finance and Admin & Operations, because that is where the money and the paperwork are. A module added later inherits everything already set up.",
  },
  {
    title: "Bring the people in",
    body: "Staff go into HRM once, with their unit and job title. They sign in to every module they are given, and leavers lose access when they leave.",
  },
  {
    title: "Run it as one",
    body: "Requests go through one inbox, payroll and purchases post to one set of books, projects see their real spend, and every step lands in the same audit trail.",
  },
];

export function AdoptionPath() {
  return (
    <ol className="grid gap-10 lg:grid-cols-4 lg:gap-8">
      {STEPS.map((step, index) => {
        const hasNext = index < STEPS.length - 1;

        return (
          <li key={step.title} className="relative flex gap-5 lg:block">
            {/* Vertical on mobile, horizontal on desktop; absent after the
                last step, which is the whole point of drawing it per item. */}
            {hasNext && (
              <>
                <span
                  className="absolute left-[21px] top-12 -bottom-10 w-0.5 rounded-full bg-neutral-200 lg:hidden"
                  aria-hidden="true"
                />
                <span
                  className="absolute left-13 -right-8 top-[21px] hidden h-0.5 rounded-full bg-neutral-200 lg:block"
                  aria-hidden="true"
                />
              </>
            )}

            <span className="tnum relative z-10 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 font-heading text-base font-bold text-white shadow-sm">
              {index + 1}
            </span>

            <div className="min-w-0 lg:mt-6">
              <h3 className="font-heading text-lg font-semibold text-neutral-900">
                {step.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">
                {step.body}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
