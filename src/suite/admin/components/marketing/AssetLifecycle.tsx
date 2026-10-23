import { Wallet } from "lucide-react";
import { MockFrame } from "@/components/platform/MockFrame";

/**
 * One asset, from acquisition to disposal — and the same asset seen twice.
 *
 * The lifecycle bar is drawn in the neutral ramp alone: reached stages in ink,
 * the current stage darkest with a marker, the rest in Line. Lightness plus the
 * words underneath carry the state, which is what lets this page keep its
 * promise of having no accent hue without losing any meaning.
 *
 * The book-value row at the bottom is the point of the whole visual: Admin
 * holds the operational view of the asset and Finance holds the depreciating
 * one, and there is only one asset.
 */

const STAGES = [
  "Acquired",
  "Assigned",
  "Serviced",
  "Returned",
  "Disposed",
] as const;

/** Zero-based. The asset is with its custodian and has not been serviced yet. */
const CURRENT = 1;

const DETAIL = [
  { term: "Asset tag", value: "AST-00418" },
  { term: "Category", value: "Laptop · IT" },
  { term: "Custodian", value: "Operations · seat 12" },
  { term: "Location", value: "Head office" },
  { term: "Acquired", value: "2025-02-14" },
  { term: "Next service", value: "2026-04-30" },
];

export function AssetLifecycle() {
  return (
    <MockFrame label="admin / asset register" hue="neutral">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Asset lifecycle
        </p>
        <p className="tnum label-mono text-neutral-500">
          Stage {CURRENT + 1} of {STAGES.length} · {STAGES[CURRENT]}
        </p>
      </div>

      <ol
        className="mt-4 flex gap-1"
        aria-label={`Asset lifecycle, currently at stage ${CURRENT + 1} of ${STAGES.length}: ${STAGES[CURRENT]}`}
      >
        {STAGES.map((stage, index) => {
          const reached = index <= CURRENT;
          return (
            <li key={stage} className="min-w-0 flex-1">
              <span
                className={`block h-1.5 rounded-full ${
                  index === CURRENT
                    ? "bg-neutral-900"
                    : reached
                      ? "bg-neutral-500"
                      : "bg-neutral-200"
                }`}
                aria-hidden="true"
              />
              <span
                className={`label-mono mt-2 hidden truncate sm:block ${
                  index === CURRENT
                    ? "font-semibold text-neutral-900"
                    : reached
                      ? "text-neutral-500"
                      : "text-neutral-500"
                }`}
              >
                {stage}
              </span>
              <span className="sr-only sm:hidden">{stage}</span>
            </li>
          );
        })}
      </ol>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-neutral-200 pt-4">
        {DETAIL.map((row) => (
          <div key={row.term} className="min-w-0">
            <dt className="label-mono text-neutral-500">{row.term}</dt>
            <dd className="tnum mt-0.5 truncate text-[13px] text-neutral-900">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 flex items-start gap-2.5 rounded-lg bg-neutral-50 px-3 py-2.5 text-xs leading-relaxed text-neutral-600">
        <Wallet className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neutral-500" aria-hidden="true" />
        <span>
          <span className="tnum font-semibold text-neutral-900">612,000</span>{" "}
          net book value in Finance&apos;s fixed asset register. One asset, two
          views — operational here, depreciating there.
        </span>
      </p>
    </MockFrame>
  );
}
