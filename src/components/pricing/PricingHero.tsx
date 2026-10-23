import { Check } from "lucide-react";

import { SectionHeading } from "@/components/site/SectionHeading";
import { Sky } from "@/components/site/Sky";

/**
 * The pricing hero: the promise on the lilac sky, three short facts as chips,
 * and the plans themselves rising out of the fold (passed in as children), the
 * same way the home page lifts the workspace out of its sky.
 */

const FACTS = ["No subscriptions or renewals", "Priced in naira or US dollars", "Source code available by request"];

export function PricingHero({ children }: { children?: React.ReactNode }) {
  return (
    <Sky className="pb-16 sm:pb-20 lg:pb-24">
      <div className="section-container">
        <SectionHeading
          as="h1"
          eyebrow="Pricing"
          title={
            <>
              Pay once.
              <br className="hidden sm:block" /> Run your company on it for good.
            </>
          }
          intro="Pick how many XwiftHQ modules you need and buy them outright. The more you take, the less each one costs, and nobody sends you a renewal."
        />

        <ul className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
          {FACTS.map((fact) => (
            <li key={fact} className="xw-chip">
              <Check className="h-3.5 w-3.5 text-primary-600" aria-hidden="true" />
              {fact}
            </li>
          ))}
        </ul>

        {children && <div className="mt-12 sm:mt-14">{children}</div>}
      </div>
    </Sky>
  );
}
