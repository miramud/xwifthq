import { Wallet } from "lucide-react";
import { MockFrame } from "@/components/platform/MockFrame";

/**
 * One asset, from acquisition to disposal, and the same asset seen twice.
 *
 * The lifecycle bar runs in purple: reached stages in a light tint, the
 * current stage in full purple, the rest in a pale line. Lightness plus the
 * words underneath carry the state, so nothing depends on colour alone.
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
        <p className="tnum rounded-full bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
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
                    ? "bg-primary-600"
                    : reached
                      ? "bg-primary-300"
                      : "bg-neutral-200"
                }`}
                aria-hidden="true"
              />
              <span
                className={`mt-2 hidden truncate text-[11px] sm:block ${
                  index === CURRENT
                    ? "font-semibold text-primary-700"
                    : reached
                      ? "text-neutral-600"
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

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-neutral-50 p-4">
        {DETAIL.map((row) => (
          <div key={row.term} className="min-w-0">
            <dt className="text-[11px] text-neutral-500">{row.term}</dt>
            <dd className="tnum mt-0.5 truncate text-[13px] font-medium text-neutral-900">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="mt-4 flex items-start gap-2.5 rounded-2xl bg-primary-50 px-3.5 py-3 text-xs leading-relaxed text-neutral-700">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white" aria-hidden="true">
          <Wallet className="h-3.5 w-3.5 text-primary-700" />
        </span>
        <span>
          <span className="tnum font-semibold text-neutral-900">612,000</span>{" "}
          net book value in Finance&apos;s fixed asset register. One asset, two
          views: operational here, depreciating there.
        </span>
      </p>
    </MockFrame>
  );
}
