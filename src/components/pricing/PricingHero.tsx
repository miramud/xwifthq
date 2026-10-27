import { Check } from "lucide-react";

import { SectionHeading } from "@/components/site/SectionHeading";
import { Sky } from "@/components/site/Sky";

/**
 * The pricing hero: the promise on the lilac sky, four short facts as chips,
 * and the plans themselves rising out of the fold (passed in as children), the
 * same way the home page lifts the workspace out of its sky.
 */

const FACTS = [
  "Free for up to 10 employees",
  "30-day trial of the whole suite",
  "Priced in naira, built in Nigeria",
  "Own it: the licence never expires",
];

export function PricingHero({ children }: { children?: React.ReactNode }) {
  return (
    <Sky className="pb-16 sm:pb-20 lg:pb-24">
      <div className="section-container">
        <SectionHeading
          as="h1"
          eyebrow="Pricing"
          title={
            <>
              Rent it or own it.
              <br className="hidden sm:block" /> Run your whole company on one record.
            </>
          }
          intro="XwiftHQ Cloud is priced per employee a month. XwiftHQ Own is a licence you buy once, sized to your company. Both run the same five connected modules, and the more you take, the less each one costs."
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
