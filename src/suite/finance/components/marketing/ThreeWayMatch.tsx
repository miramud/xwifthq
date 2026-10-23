import {
  ArrowDown,
  CircleCheck,
  FileText,
  Receipt,
  TriangleAlert,
  Truck,
} from "lucide-react";

/**
 * Three-way match, drawn.
 *
 * The argument of this diagram is not "three documents exist" — it is that two
 * of them were raised in Admin & Operations before the third arrived, so matching is
 * a lookup rather than a search. The three source documents therefore carry the
 * *same reference* and the *same quantities*, and exactly one line disagrees.
 * The exception is the point: what reaches an approver is the one held line,
 * not the pile.
 *
 * The connectors are an SVG that stretches to the height of the column beside
 * it (`preserveAspectRatio="none"` plus `vectorEffect="non-scaling-stroke"`, so
 * the curves follow the boxes while the hairline stays a hairline). Below `sm`
 * the whole thing stacks and a single arrow replaces them.
 */

interface SourceDoc {
  icon: typeof FileText;
  kind: string;
  reference: string;
  raisedIn: string;
  lines: { label: string; value: string }[];
}

const SOURCES: readonly SourceDoc[] = [
  {
    icon: FileText,
    kind: "Purchase order",
    reference: "PO-2291",
    raisedIn: "Raised in Operations",
    lines: [
      { label: "Desk chairs", value: "24" },
      { label: "Toner cartridges", value: "12" },
    ],
  },
  {
    icon: Truck,
    kind: "Goods received",
    reference: "GRN-2291",
    raisedIn: "Received in Operations",
    lines: [
      { label: "Desk chairs", value: "24" },
      { label: "Toner cartridges", value: "10" },
    ],
  },
  {
    icon: Receipt,
    kind: "Vendor bill",
    reference: "INV-4471",
    raisedIn: "Recorded in Operations",
    lines: [
      { label: "Desk chairs", value: "24" },
      { label: "Toner cartridges", value: "12" },
    ],
  },
];

/**
 * `tone` lets the Admin & Operations page use the same diagram without
 * borrowing Finance's gold: "neutral" swaps every gold mark for ink.
 */
const TONES = {
  accent: {
    dot: "#b7801b",
    box: "border-accent-500/30 bg-accent-500/10",
    glyph: "text-accent-700",
    rule: "border-accent-500",
  },
  neutral: {
    dot: "#34464A",
    box: "border-neutral-300 bg-neutral-100",
    glyph: "text-neutral-700",
    rule: "border-neutral-700",
  },
} as const;

export function ThreeWayMatch({ tone = "accent" }: { tone?: keyof typeof TONES } = {}) {
  const t = TONES[tone];

  return (
    <div
      role="img"
      aria-label="Three-way match: a purchase order, a goods-received note and a vendor bill all carrying reference 2291 converge on one matched state. The desk-chair line agrees across all three at 24 units and goes on to payment. The toner line was ordered and billed as 12 but received as 10, so it is held as an exception for review."
      className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Three-way match
        </p>
        <p className="label-mono tnum text-neutral-500">Ref 2291</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,10rem)] sm:items-center sm:gap-0">
        <ul className="space-y-2.5">
          {SOURCES.map((source) => {
            const Glyph = source.icon;
            return (
              <li
                key={source.reference}
                className="rounded-xl border border-neutral-200 bg-neutral-50 p-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white ring-1 ring-neutral-200">
                    <Glyph
                      className="h-3.5 w-3.5 text-neutral-700"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-neutral-900">
                      {source.kind}
                    </span>
                    <span className="label-mono block truncate text-neutral-500">
                      {source.raisedIn}
                    </span>
                  </span>
                  <span className="tnum label-mono shrink-0 text-neutral-500">
                    {source.reference}
                  </span>
                </div>

                <dl className="mt-2.5 space-y-1 border-t border-neutral-200 pt-2">
                  {source.lines.map((line) => (
                    <div
                      key={line.label}
                      className="flex items-baseline gap-2 text-xs"
                    >
                      <dt className="min-w-0 flex-1 truncate text-neutral-500">
                        {line.label}
                      </dt>
                      <dd className="tnum shrink-0 font-medium text-neutral-900">
                        {line.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </li>
            );
          })}
        </ul>

        {/* Converging connectors — desktop only; they need the height to work. */}
        <svg
          className="hidden h-full w-10 self-stretch sm:block"
          viewBox="0 0 40 120"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g
            stroke="#b7c7c6"
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          >
            <path d="M0 20C18 20 22 60 40 60" vectorEffect="non-scaling-stroke" />
            <path d="M0 60H40" vectorEffect="non-scaling-stroke" />
            <path
              d="M0 100C18 100 22 60 40 60"
              vectorEffect="non-scaling-stroke"
            />
          </g>
          <circle cx="37" cy="60" r="2.5" fill={t.dot} />
        </svg>

        {/* Mobile replacement for the connectors. */}
        <div className="flex justify-center sm:hidden" aria-hidden="true">
          <ArrowDown className="h-5 w-5 text-neutral-300" />
        </div>

        <div className={`rounded-xl border p-4 ${t.box}`}>
          <CircleCheck
            className={`h-5 w-5 ${t.glyph}`}
            aria-hidden="true"
          />
          <p className="mt-2 font-heading text-sm font-semibold text-neutral-900">
            Matched
          </p>
          <p className="tnum mt-1 text-xs leading-relaxed text-neutral-700">
            1 of 2 lines matches. 1 line is held.
          </p>
        </div>
      </div>

      {/*
        The held line. A gold rule marks it and the words carry the meaning —
        "held for review" is on the page, so the colour is never doing the work
        on its own.
      */}
      <div className={`mt-4 flex items-start gap-3 rounded-r-lg border-l-2 bg-neutral-50 px-4 py-3 ${t.rule}`}>
        <TriangleAlert
          className={`mt-0.5 h-4 w-4 shrink-0 ${t.glyph}`}
          aria-hidden="true"
        />
        <p className="tnum text-xs leading-relaxed text-neutral-700">
          <span className="font-semibold text-neutral-900">
            Toner cartridges —
          </span>{" "}
          ordered 12, received 10, billed 12. Held for review before any payment
          memo is raised. The matched line goes on to Finance.
        </p>
      </div>
    </div>
  );
}
