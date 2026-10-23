import { MoveRight, ScrollText } from "lucide-react";

/**
 * The delegated authority matrix, drawn as a real table because a table is
 * the honest form for it.
 *
 * Value bands down, categories across, the approver in the cell. Drawing this
 * as a stack of cards would have been easier to make responsive and would have
 * lost the thing that matters: you read a matrix by finding the intersection,
 * and an intersection needs two axes.
 *
 * So it scrolls inside its own wrapper instead of stretching the page. The
 * wrapper is a named, focusable region: a scroll container a mouse can reach
 * and a keyboard cannot is a trap, and `tabindex=0` plus an accessible name is
 * what makes it reachable. The fade at the right edge is the affordance that
 * says there is more, and the small hint underneath says it in words as well.
 *
 * The card is a white frame on a purple glow, the header row sits on a lilac
 * wash and the version badge is a pill.
 */

const CATEGORIES = [
  "Facilities",
  "IT & assets",
  "Fleet",
  "Professional services",
] as const;

interface Band {
  range: string;
  approvers: readonly [string, string, string, string];
}

/** Illustrative thresholds in naira. A real organisation publishes its own. */
const BANDS: readonly Band[] = [
  {
    range: "Up to 500,000",
    approvers: [
      "Facilities Officer",
      "IT Officer",
      "Fleet Officer",
      "Head of Admin",
    ],
  },
  {
    range: "500,001 to 2,000,000",
    approvers: [
      "Head of Admin",
      "Head of Admin",
      "Head of Admin",
      "Head of Admin",
    ],
  },
  {
    range: "2,000,001 to 10,000,000",
    approvers: [
      "Finance Director",
      "Finance Director",
      "Finance Director",
      "Finance Director",
    ],
  },
  {
    range: "Above 10,000,000",
    approvers: [
      "Managing Director",
      "Managing Director",
      "Managing Director",
      "Board committee",
    ],
  },
];

export function AuthorityMatrix() {
  return (
    <div className="xw-frame p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Delegated authority matrix
        </p>
        <p className="rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
          Published · v4
        </p>
      </div>

      <div className="relative mt-5">
        <div
          role="region"
          aria-label="Delegated authority matrix: approver by value band and spend category"
          tabIndex={0}
          className="overflow-x-auto rounded-2xl border border-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        >
          <table className="w-full min-w-[34rem] border-collapse text-left">
            <caption className="sr-only">
              Illustrative delegated authority matrix. Rows are value bands in
              naira; columns are spend categories; each cell names the role that
              approves at that intersection.
            </caption>
            <thead>
              <tr className="bg-primary-50/70">
                <th
                  scope="col"
                  className="border-b border-neutral-200 px-3 py-2.5 text-xs font-semibold text-primary-800"
                >
                  Value band
                </th>
                {CATEGORIES.map((category) => (
                  <th
                    key={category}
                    scope="col"
                    className="border-b border-l border-neutral-200 px-3 py-2.5 text-xs font-semibold text-primary-800"
                  >
                    {category}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BANDS.map((band) => (
                <tr key={band.range} className="align-top">
                  <th
                    scope="row"
                    className="tnum border-b border-neutral-200 bg-white px-3 py-3 text-[13px] font-semibold text-neutral-900"
                  >
                    {band.range}
                  </th>
                  {band.approvers.map((approver, index) => (
                    <td
                      key={`${band.range}-${CATEGORIES[index]}`}
                      className="border-b border-l border-neutral-200 px-3 py-3 text-[13px] text-neutral-600"
                    >
                      {approver}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Edge affordance. Decorative, and it must never eat a click. */}
        <span
          className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-2xl bg-gradient-to-l from-white to-transparent"
          aria-hidden="true"
        />
      </div>

      {/*
        Unconditional, not `lg:hidden`. The matrix sits in a half-width column
        on every screen this page is read on, so it scrolls at desktop as well.
        Hiding the hint above `lg` would have left the widest readers with a
        clipped last column and nothing telling them it moves.
      */}
      <p className="mt-3 flex items-center gap-2 text-xs font-medium text-neutral-500">
        Scroll sideways to see more
        <MoveRight className="h-3.5 w-3.5" aria-hidden="true" />
      </p>

      <p className="mt-4 flex items-start gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-xs leading-relaxed text-neutral-600">
        <span
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100"
          aria-hidden="true"
        >
          <ScrollText className="h-3.5 w-3.5 text-primary-700" />
        </span>
        <span>
          Every module reads from this table. Raise a limit for procurement and
          it rises for Finance payment runs at the same moment. Every decision
          made against it lands as one entry in the shared audit log.
        </span>
      </p>
    </div>
  );
}
