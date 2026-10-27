import { RequestButton } from "./RequestButton";
import { CARE_PERCENT, CARE_PLUS_PERCENT, ONBOARDING, formatPrice, type PriceList } from "@/lib/pricing/price-book";

/**
 * What sits around a plan: Care for Own licences, the one-time onboarding
 * packages, and the add-ons. Server-rendered and static, so the onboarding
 * prices show all three price lists at once rather than following a picker.
 */

const CARE_ROWS: { label: string; care: string; plus: string }[] = [
  {
    label: "Price",
    care: `${CARE_PERCENT}% of the licence list price a year, from year two. Year one is included.`,
    plus: `${CARE_PLUS_PERCENT}% a year.`,
  },
  { label: "Hosting", care: "The shared XwiftHQ cloud, with daily backups.", plus: "The same, plus a sandbox copy." },
  {
    label: "Updates",
    care: "Every new release of the modules you own, security fixes, and statutory changes (PAYE, pension, VAT, WHT).",
    plus: "The same, plus priority on feature requests.",
  },
  {
    label: "Support",
    care: "Email and WhatsApp in business hours, next-business-day response.",
    plus: "4-hour response, a named success manager and a quarterly review.",
  },
  {
    label: "Training",
    care: "The knowledge base and recorded courses in the XwiftHQ Academy.",
    plus: "Two live training days a year.",
  },
];

export function CarePlans() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      {(["care", "plus"] as const).map((plan) => (
        <article key={plan} className={`p-7 sm:p-8 ${plan === "care" ? "xw-glow-card" : "xw-tile"}`}>
          <h3 className="xw-h3">{plan === "care" ? "Care" : "Care Plus"}</h3>
          <dl className="mt-5 space-y-4">
            {CARE_ROWS.map((row) => (
              <div key={row.label}>
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">{row.label}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-neutral-700">{plan === "care" ? row.care : row.plus}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
    </div>
  );
}

const LISTS: { key: PriceList; label: string }[] = [
  { key: "NG", label: "Nigeria" },
  { key: "AFR", label: "Africa" },
  { key: "INT", label: "International" },
];

export function OnboardingPackages() {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
      {ONBOARDING.map((pkg) => (
        <li key={pkg.key} className="xw-tile flex flex-col p-6">
          <h3 className="xw-h3">{pkg.label}</h3>
          <p className="mt-1 text-sm text-neutral-500">{pkg.forWhom}</p>
          <dl className="mt-4 space-y-1 text-sm">
            {LISTS.map((list) => {
              const price = pkg.price[list.key];
              return (
                <div key={list.key} className="flex justify-between gap-3">
                  <dt className="text-neutral-500">{list.label}</dt>
                  <dd className="tnum font-semibold text-neutral-900">
                    {price === null ? "Quoted" : `${pkg.from ? "From " : ""}${formatPrice(price, list.key)}`}
                  </dd>
                </div>
              );
            })}
          </dl>
          <p className="mt-4 text-sm leading-relaxed text-neutral-600">{pkg.includes}</p>
        </li>
      ))}
    </ul>
  );
}

const ADD_ONS: { label: string; price: string; note: string }[] = [
  {
    label: "Dedicated server and your own domain",
    price: "₦3m a year ($2,700 Africa, $5,400 International)",
    note: "Your data on a server of its own, at an address such as hq.yourcompany.com.",
  },
  {
    label: "Extra legal entity",
    price: "Cloud +15%; Own ₦1.5m per entity, plus Care",
    note: "For group companies, with consolidated reporting.",
  },
  { label: "Sandbox copy", price: "₦600,000 a year", note: "Included in Care Plus." },
  {
    label: "Managed AI",
    price: "Credit packs at provider cost + 40%",
    note: "For teams that won't bring a key. Bringing your own key stays free, and is the default.",
  },
  {
    label: "External learners",
    price: "₦100,000 a month per 500 active learners",
    note: "Train customers or partners on your LMS, with certificates anyone can verify.",
  },
  {
    label: "Source-code escrow",
    price: "₦2.5m a year",
    note: "The code is lodged with an escrow agent and released to you if we stop trading or supporting the product.",
  },
  { label: "Extra training day", price: "₦350,000 a day", note: "In Lagos or Abuja; travel is extra elsewhere." },
];

export function AddOns() {
  return (
    <>
      <ul className="divide-y divide-neutral-200/80 overflow-hidden rounded-[1.25rem] border border-neutral-200/80 bg-white">
        {ADD_ONS.map((addOn) => (
          <li key={addOn.label} className="grid gap-1 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:gap-6 sm:px-6">
            <div>
              <h3 className="font-heading text-base font-semibold text-neutral-900">{addOn.label}</h3>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">{addOn.note}</p>
            </div>
            <p className="tnum text-sm font-semibold text-neutral-800 sm:text-right">{addOn.price}</p>
          </li>
        ))}
      </ul>
      <div className="mt-6 flex flex-col items-center gap-4 text-center">
        <p className="max-w-2xl text-sm leading-relaxed text-neutral-500">
          Add-ons are listed in naira; on the Africa and International lists we quote them in US dollars.
        </p>
        <RequestButton
          type="dedicated_hosting"
          label="Talk to the technical team"
          copy={{
            intro:
              "A dedicated server, an extra entity, a sandbox or escrow: tell us what you need and our technical team quotes it with you.",
          }}
        />
      </div>
    </>
  );
}
