"use client";

import { useId, useState } from "react";
import { ArrowRight } from "lucide-react";
import { SalesRequestDialog } from "./SalesRequestDialog";
import { ListPicker, ModulePicker } from "./PricePickers";
import { modulesLabel } from "./PricingPlans";
import {
  CLOUD_MIN_EMPLOYEES,
  OWN_QUOTE_FROM,
  RENT_TO_OWN,
  bandFor,
  careYearly,
  cloudYearly,
  formatPrice,
  listInfo,
  onboardingFor,
  ownBreakEvenYears,
  ownLicence,
  ownTotal,
  rentToOwnPayment,
  type ModuleCount,
  type PriceList,
} from "@/lib/pricing/price-book";

const MAX_EMPLOYEES = 5000;
const YEARS = 5;

/** 3.1 → "about 3 years", 2.6 → "about 2.5 years". */
function aboutYears(years: number): string {
  const half = Math.max(1, Math.round(years * 2) / 2);
  return `about ${half} ${half === 1 ? "year" : "years"}`;
}

/**
 * "Price my company": headcount, modules and price list in; the Cloud bill,
 * the Own licence with Care, five years of each side by side, and the
 * onboarding package out. The figures are the price book's, so they match
 * the cards above to the naira.
 */
export function PriceCalculator() {
  const uid = useId();
  const [employees, setEmployees] = useState(50);
  const [count, setCount] = useState<ModuleCount>(5);
  const [list, setList] = useState<PriceList>("NG");
  const [requesting, setRequesting] = useState(false);

  const price = (minor: number) => formatPrice(minor, list);
  const n = Math.min(Math.max(1, Math.round(employees) || 1), MAX_EMPLOYEES);

  const cloud = cloudYearly(list, count, n);
  const band = bandFor(n);
  const licence = band ? ownLicence(band, list, count) : null;
  const care = licence !== null ? careYearly(licence) : null;
  const [twelve] = RENT_TO_OWN;
  const onboarding = onboardingFor(n);
  const onboardingPrice = onboarding.price[list];
  const breakEven = cloud !== null && licence !== null ? ownBreakEvenYears(licence, cloud) : null;

  const summary = [
    `Price my company: ${n} employees, ${modulesLabel(count)}, ${listInfo(list).label} price list.`,
    cloud !== null ? `Cloud: ${price(cloud)} a year.` : "Cloud: quoted (over 500 employees).",
    licence !== null && band
      ? `Own: ${band.label} licence ${price(licence)}, Care ${price(care!)} a year from year two.`
      : `Own: quoted (over 1,000 employees).`,
    `Onboarding: ${onboarding.label}${onboardingPrice !== null ? `, ${onboarding.from ? "from " : ""}${price(onboardingPrice)}` : ", quoted"}.`,
  ].join(" ");

  return (
    <div className="xw-glow-card p-6 sm:p-10">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,18rem)_1fr] lg:items-end">
        <div>
          <label htmlFor={`${uid}-employees`} className="text-xs font-semibold uppercase tracking-[0.08em] text-neutral-500">
            Employees
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              id={`${uid}-employees`}
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_EMPLOYEES}
              value={employees}
              onChange={(e) => setEmployees(Number(e.target.value))}
              className="tnum h-12 w-28 rounded-xl border border-neutral-300 bg-white px-3 text-lg font-semibold text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            />
            <input
              type="range"
              min={1}
              max={1000}
              value={Math.min(n, 1000)}
              onChange={(e) => setEmployees(Number(e.target.value))}
              aria-label="Employees"
              className="w-full accent-primary-600"
            />
          </div>
        </div>
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-end sm:gap-8">
          <ModulePicker value={count} onChange={setCount} />
          <ListPicker value={list} onChange={setList} />
        </div>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2" aria-live="polite">
        <Result
          title="XwiftHQ Cloud"
          headline={cloud !== null ? `${price(cloud)} a year` : "Quoted"}
          lines={
            cloud !== null
              ? [
                  `About ${price(Math.round(cloud / 12))} a month on yearly billing`,
                  n < CLOUD_MIN_EMPLOYEES
                    ? `Billed as ${CLOUD_MIN_EMPLOYEES} employees, the minimum. Up to 10 employees can also run HR, payroll and basic learning on XwiftHQ Free.`
                    : `${YEARS} years: ${price(cloud * YEARS)}`,
                ]
              : ["Over 500 employees, Cloud is priced with you as an Enterprise plan."]
          }
        />
        <Result
          title={band ? `XwiftHQ Own, ${band.label}` : "XwiftHQ Own"}
          headline={licence !== null ? `${price(licence)} once` : `Quoted, from ${price(OWN_QUOTE_FROM[list])}`}
          lines={
            licence !== null && care !== null
              ? [
                  `Care ${price(care)} a year from year two, or ${twelve.payments} payments of ${price(rentToOwnPayment(licence, twelve.payments, twelve.uplift))}`,
                  `${YEARS} years: ${price(ownTotal(licence, YEARS))}`,
                ]
              : ["Over 1,000 employees, Own is priced with you as an Enterprise licence."]
          }
        />
      </div>

      <div className="mt-5 flex flex-col gap-4 rounded-2xl bg-primary-50 p-5 text-sm leading-relaxed text-primary-900 sm:flex-row sm:items-center sm:justify-between">
        <p>
          {breakEven !== null ? (
            <>
              Owning costs less than renting after <strong>{aboutYears(breakEven)}</strong>.{" "}
            </>
          ) : cloud !== null && licence !== null ? (
            <>Renting stays cheaper than owning for at least ten years. </>
          ) : null}
          {onboarding.label} onboarding
          {onboardingPrice !== null
            ? ` is ${onboarding.from ? "from " : ""}${price(onboardingPrice)}, once.`
            : " is quoted for your roll-out."}
        </p>
        <button type="button" onClick={() => setRequesting(true)} className="btn-primary min-h-11 shrink-0">
          Send me this quote
          <ArrowRight size={16} aria-hidden="true" />
        </button>
      </div>

      {requesting && (
        <SalesRequestDialog
          type="enterprise"
          open
          onClose={() => setRequesting(false)}
          currency={listInfo(list).currency}
          plan={summary}
          copy={{
            title: "Your XwiftHQ quote",
            intro: "We send these figures as a written quote, and our team can walk you through either option.",
            submit: "Send me the quote",
          }}
        />
      )}
    </div>
  );
}

function Result({ title, headline, lines }: { title: string; headline: string; lines: string[] }) {
  return (
    <div className="rounded-2xl border border-neutral-200/80 bg-white p-5">
      <h3 className="text-sm font-semibold text-neutral-500">{title}</h3>
      <p className="tnum mt-2 font-heading text-2xl font-bold tracking-[-0.02em] text-neutral-900 sm:text-3xl">
        {headline}
      </p>
      <ul className="mt-3 space-y-1.5 text-sm leading-relaxed text-neutral-600">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
