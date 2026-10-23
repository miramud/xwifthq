import Link from "next/link";

import { HUE, PRODUCTS, SUITE_FLOWS } from "@/lib/products";
import { SectionHeading } from "@/components/site/SectionHeading";

/**
 * The cross module handovers, drawn as numbered timelines. Each step names
 * the module that acts, so the suite argument is shown rather than claimed.
 */
export function FlowsSection() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <SectionHeading
          eyebrow="Connected by design"
          title="Work moves on by itself"
          intro="When one team finishes, the next one already has what it needs. No exports, no re-keying, no chasing."
        />

        <ul className="mt-14 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {SUITE_FLOWS.map((flow, fi) => (
            <li key={flow.title} className={`xw-tile p-6 ${fi === 0 ? "lg:col-span-1" : ""}`}>
              <h3 className="xw-h3">{flow.title}</h3>
              <ol className="mt-5 space-y-0">
                {flow.steps.map((step, i) => {
                  const product = PRODUCTS[step.module];
                  const last = i === flow.steps.length - 1;
                  return (
                    <li key={`${step.module}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
                      {!last && <span className="absolute left-[11px] top-6 h-[calc(100%-1rem)] w-px bg-neutral-300" aria-hidden="true" />}
                      <span className="relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-bold text-neutral-700 ring-1 ring-neutral-200">
                        {i + 1}
                      </span>
                      <span className="min-w-0 pt-0.5">
                        <span className="block text-sm leading-snug text-neutral-800">{step.action}</span>
                        <span className={`mt-1 inline-flex items-center gap-1.5 text-xs font-medium ${HUE[product.hue].text}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${HUE[product.hue].rule}`} aria-hidden="true" />
                          {product.shortName === "Admin" ? "Operations" : product.shortName}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
          <li className="flex flex-col justify-between rounded-[1.25rem] bg-neutral-900 p-6 text-white">
            <p className="font-heading text-lg font-semibold leading-snug">
              Every handover is logged in one audit trail, with who did what and when.
            </p>
            <Link href="/platform" className="mt-6 inline-flex w-fit items-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-primary-50">
              Explore the platform
            </Link>
          </li>
        </ul>
      </div>
    </section>
  );
}
