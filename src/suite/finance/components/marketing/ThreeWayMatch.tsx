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
 * The argument of this diagram is not "three documents exist". It is that two
 * of them were raised in Admin & Operations before the third arrived, so
 * matching is a lookup rather than a search. The three source documents
 * therefore carry the same reference and the same quantities, and exactly one
 * line disagrees. The exception is the point: what reaches an approver is the
 * one held line, not the pile.
 *
 * The connectors are an SVG that stretches to the height of the column beside
 * it (`preserveAspectRatio="none"` plus `vectorEffect="non-scaling-stroke"`, so
 * the curves follow the boxes while the hairline stays a hairline). Below `sm`
 * the whole thing stacks and a single arrow replaces them. The drawing sits in
 * an `.xw-frame`, with the documents on pale rows and round white icon discs.
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
 * `tone` lets the Admin & Operations page reuse the diagram in plain ink:
 * "accent" (the default) marks the match in XwiftHQ purple, "neutral" swaps
 * every purple mark for grey.
 */
const TONES = {
  accent: {
    dot: "fill-primary-600",
    line: "stroke-primary-200",
    box: "border-primary-200 bg-primary-50",
    disc: "bg-primary-600 text-white",
    glyph: "text-primary-700",
    held: "bg-primary-50",
  },
  neutral: {
    dot: "fill-neutral-700",
    line: "stroke-neutral-300",
    box: "border-neutral-200 bg-neutral-100",
    disc: "bg-neutral-800 text-white",
    glyph: "text-neutral-700",
    held: "bg-neutral-100",
  },
} as const;

export function ThreeWayMatch({ tone = "accent" }: { tone?: keyof typeof TONES } = {}) {
  const t = TONES[tone];

  return (
    <div
      role="img"
      aria-label="Three-way match: a purchase order, a goods-received note and a vendor bill all carrying reference 2291 converge on one matched state. The desk-chair line agrees across all three at 24 units and goes on to payment. The toner line was ordered and billed as 12 but received as 10, so it is held as an exception for review."
      className="xw-frame p-4 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] text-neutral-500">Matching</p>
          <p className="font-heading text-sm font-bold text-neutral-900">
            Three-way match
          </p>
        </div>
        <span className="tnum shrink-0 rounded-full border border-neutral-200 px-2.5 py-1 text-[10px] font-medium text-neutral-600">
          Ref 2291
        </span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,10rem)] sm:items-center sm:gap-0">
        <ul className="space-y-2.5">
          {SOURCES.map((source) => {
            const Glyph = source.icon;
            return (
              <li
                key={source.reference}
                className="rounded-2xl bg-neutral-50 p-3"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_6px_16px_-8px_rgb(16_18_31/0.25)]">
                    <Glyph
                      className="h-3.5 w-3.5 text-neutral-700"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-neutral-900">
                      {source.kind}
                    </span>
                    <span className="block truncate text-[11px] text-neutral-500">
                      {source.raisedIn}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-[11px] font-medium text-neutral-500">
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

        {/* Converging connectors, desktop only: they need the height to work. */}
        <svg
          className="hidden h-full w-10 self-stretch sm:block"
          viewBox="0 0 40 120"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <g
            className={t.line}
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
          <circle cx="37" cy="60" r="2.5" className={t.dot} />
        </svg>

        {/* Mobile replacement for the connectors. */}
        <div className="flex justify-center sm:hidden" aria-hidden="true">
          <ArrowDown className="h-5 w-5 text-neutral-400" />
        </div>

        <div className={`rounded-2xl border p-4 ${t.box}`}>
          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${t.disc}`}>
            <CircleCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="mt-2.5 font-heading text-sm font-semibold text-neutral-900">
            Matched
          </p>
          <p className="tnum mt-1 text-xs leading-relaxed text-neutral-700">
            1 of 2 lines matched. 1 line held.
          </p>
        </div>
      </div>

      {/*
        The held line. A tinted panel marks it and the words carry the meaning:
        "held for review" is on the page, so the colour is never doing the work
        on its own.
      */}
      <div className={`mt-4 flex items-start gap-3 rounded-2xl px-4 py-3 ${t.held}`}>
        <TriangleAlert
          className={`mt-0.5 h-4 w-4 shrink-0 ${t.glyph}`}
          aria-hidden="true"
        />
        <p className="tnum text-xs leading-relaxed text-neutral-700">
          <span className="font-semibold text-neutral-900">
            Toner cartridges:
          </span>{" "}
          ordered 12, received 10, billed 12. Held for review before any payment
          memo is raised. The matched line moves on to Finance.
        </p>
      </div>
    </div>
  );
}
