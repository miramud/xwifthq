import { CalendarCheck, Repeat, Sparkles, type LucideIcon } from "lucide-react";
import { RequestButton } from "./RequestButton";

/**
 * The launch offers from the strategy (Section 7): each answers one reason a
 * buyer hesitates (price, effort, risk). Founding 50 is the one with a
 * deadline, so it leads and carries the button.
 */

const OFFERS: { icon: LucideIcon; title: string; body: string; note: string; cta?: boolean }[] = [
  {
    icon: Sparkles,
    title: "Founding 50",
    body: "The first 50 Cloud customers get 30% off for 24 months and free onboarding. The first 10 Own buyers get 20% off the licence, with Care at 15% of what they paid.",
    note: "Closes when the places are taken, or on 31 March 2027. In return: a case study and your logo on our site.",
    cta: true,
  },
  {
    icon: Repeat,
    title: "Switch & Save",
    body: "Show us what you pay today for HR, accounting, projects and learning. For year one we charge 30% less than the combined bill, and move your data across free.",
    note: "Year two moves to the list price, or your Founding price if you have one.",
  },
  {
    icon: CalendarCheck,
    title: "First payroll in 14 days",
    body: "From signed order to a correct first payroll in 14 working days, run alongside your current one. Miss it and your first three months are free.",
    note: "The clock starts when we have your complete staff and salary data.",
  },
];

export function PricingOffers() {
  return (
    <ul className="grid gap-5 lg:grid-cols-3">
      {OFFERS.map((offer, i) => (
        <li key={offer.title} className={`flex flex-col p-7 ${i === 0 ? "xw-glow-card" : "xw-tile"}`}>
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-600 text-white">
            <offer.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <h3 className="xw-h3 mt-6">{offer.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-neutral-600">{offer.body}</p>
          <p className="mt-3 text-xs leading-relaxed text-neutral-500">{offer.note}</p>
          {offer.cta && (
            <div className="mt-6 lg:mt-auto lg:pt-6">
              <RequestButton
                label="Claim a Founding place"
                plan="Founding 50 offer"
                copy={{
                  title: "Claim a Founding place",
                  intro:
                    "Tell us about your company and whether you want to rent (Cloud) or own. Our team confirms your place and your Founding price.",
                  submit: "Claim my place",
                }}
              />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
