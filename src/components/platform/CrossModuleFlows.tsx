import { ChevronRight } from "lucide-react";
import { SectionHeader } from "@/components/platform/SectionHeader";
import {
  HUE,
  PRODUCTS,
  SUITE_FLOWS,
  type ProductSlug,
} from "@/lib/products";

/**
 * The five flows that make this a suite rather than five apps.
 *
 * Each flow is an ordered list, and the order is the argument — so it is an
 * `<ol>`, not a row of divs. The chevrons between steps are decoration on top
 * of that order and are hidden; a screen reader gets "1, 2, 3" from the list
 * itself, which is more use than "chevron right" three times.
 *
 * Every step names the module that acts, with its icon in its own hue. That is
 * the one place on a page like this where five colours appear at once, and it
 * is legitimate: telling the modules apart is exactly what the reader is doing.
 */
export function CrossModuleFlows({
  only,
  heading,
  intro,
}: {
  only?: ProductSlug;
  heading?: string;
  intro?: string;
}) {
  const flows = only
    ? SUITE_FLOWS.filter((flow) =>
        flow.steps.some((step) => step.module === only),
      )
    : SUITE_FLOWS;

  if (flows.length === 0) return null;

  return (
    <div>
      {heading && (
        <SectionHeader
          eyebrow="One dataset"
          title={heading}
          intro={intro}
          hue={only ? PRODUCTS[only].hue : undefined}
        />
      )}

      <div className={`grid gap-5 ${heading ? "mt-14" : ""}`}>
        {flows.map((flow) => (
          <div
            key={flow.title}
            className="xw-tile p-6 sm:p-7"
          >
            <h3 className="xw-h3">
              {flow.title}
            </h3>

            <ol className="mt-5 flex flex-wrap items-stretch gap-2">
              {flow.steps.map((step, index) => {
                const product = PRODUCTS[step.module];
                const hue = HUE[product.hue];
                const Glyph = product.icon;

                return (
                  <li
                    key={`${flow.title}-${index}`}
                    className="flex items-center gap-2"
                  >
                    <span
                      className="inline-flex items-center gap-2.5 rounded-full border border-neutral-200 bg-white py-1.5 pe-4 ps-1.5"
                    >
                      <span
                        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${hue.tile}`}
                      >
                        <Glyph
                          className={`h-4 w-4 ${hue.icon}`}
                          aria-hidden="true"
                        />
                      </span>
                      <span className="text-sm text-neutral-700">
                        <span className="font-semibold text-neutral-900">
                          {product.shortName}
                        </span>
                        <span className="text-neutral-500"> · </span>
                        {step.action}
                      </span>
                    </span>

                    {index < flow.steps.length - 1 && (
                      <ChevronRight
                        className="h-4 w-4 shrink-0 text-primary-300"
                        aria-hidden="true"
                      />
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}
