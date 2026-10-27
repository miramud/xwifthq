"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { ListPicker, ModulePicker } from "./PricePickers";
import type { PublicModule } from "@/lib/api/public-pricing";
import {
  BANDS,
  CARE_PERCENT,
  CLOUD_MIN_EMPLOYEES,
  CLOUD_VOLUME,
  OWN_QUOTE_FROM,
  RENT_TO_OWN,
  careYearly,
  cloudBandRate,
  cloudRate,
  formatPrice,
  listInfo,
  ownLicence,
  rentToOwnPayment,
  type ModuleCount,
  type PriceList,
} from "@/lib/pricing/price-book";

export const modulesLabel = (count: ModuleCount) =>
  count === 5 ? "all 5 modules" : `${count} ${count === 1 ? "module" : "modules"}`;

/**
 * Rent or Own: the three ways in (Free, Cloud, Own) and Own's four size
 * bands, all priced from the price book for the list and module count the
 * visitor picks.
 *
 * Every button goes to /get-started with the visitor's choice (plan, price
 * list, module count, band), where it ends in a request the team sets up and
 * invoices; checkout for the new plans is not live yet.
 * The Cloud card is the one filled in purple, the way most companies buy.
 */
export function PricingPlans({ modules }: { modules: PublicModule[] }) {
  const [list, setList] = useState<PriceList>("NG");
  const [count, setCount] = useState<ModuleCount>(5);

  const info = listInfo(list);
  const price = (minor: number, cents = false) => formatPrice(minor, list, { cents });
  const rate = cloudRate(list, count);
  const starter = ownLicence(BANDS[0], list, count);
  const start = (plan: string, extra: Record<string, string> = {}) =>
    `/get-started?${new URLSearchParams({ plan, list, ...(plan === "free" ? {} : { count: String(count) }), ...extra })}`;

  const liveCount = modules.filter((m) => m.status === "available").length;
  const comingSoon = modules.filter((m) => m.status === "coming_soon").map((m) => m.label);
  const unreleasedNote =
    count > liveCount && comingSoon.length > 0 ? `${comingSoon.join(" and ")} switched on when released` : null;

  return (
    <>
      {/* ---------- the two choices ---------- */}
      <div className="flex flex-col items-center justify-center gap-5 sm:flex-row sm:items-start sm:gap-8">
        <ListPicker value={list} onChange={setList} />
        <ModulePicker value={count} onChange={setCount} />
      </div>
      <p className="mt-3 text-center text-sm text-neutral-500">{info.note}</p>

      {/* ---------- Free, Cloud, Own ---------- */}
      <ul className="mt-10 grid gap-5 text-left lg:grid-cols-3 lg:items-center" aria-label="Ways to buy XwiftHQ">
        <PlanCard
          eyebrow="Start here"
          name="XwiftHQ Free"
          price={price(0)}
          priceNote="For up to 10 employees, for ever"
          features={[
            "HR records, leave and documents",
            "Payroll with PAYE and pension",
            "Basic learning, up to 3 courses",
            "Other modules to explore in preview",
          ]}
          cta="Start free"
          href={start("free")}
        />

        <PlanCard
          highlighted
          eyebrow="Rent it"
          name="XwiftHQ Cloud"
          price={price(rate, true)}
          priceNote={`Per employee a month, billed yearly, for ${modulesLabel(count)}`}
          extra={
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-2xl bg-white/10 p-4 text-sm">
              {CLOUD_VOLUME.map((band) => (
                <div key={band.from} className="contents">
                  <dt className="text-white/85">
                    {band.from}–{band.to} employees
                  </dt>
                  <dd className="tnum text-right font-semibold text-white">
                    {price(cloudBandRate(list, count, band.percent), true)}
                  </dd>
                </div>
              ))}
              <dt className="text-white/85">Above 500</dt>
              <dd className="text-right font-semibold text-white">Quoted</dd>
            </dl>
          }
          features={[
            "Hosting, updates, statutory changes and support",
            `Minimum ${CLOUD_MIN_EMPLOYEES} employees; leavers stop counting`,
            "Quarterly billing +10%, monthly +20%",
            "30-day trial of the whole suite, 90-day money-back",
            ...(unreleasedNote ? [unreleasedNote] : []),
          ]}
          cta="Start a 30-day trial"
          href={start("cloud")}
        />

        <PlanCard
          eyebrow="Own it"
          name="XwiftHQ Own"
          price={`From ${price(starter)}`}
          priceNote={`One-time licence for ${modulesLabel(count)}, priced by company size`}
          features={[
            "A licence that never expires",
            `Year one of Care included, then ${CARE_PERCENT}% of the licence a year`,
            "Or own it in 12 monthly payments",
            "No seat caps inside your size band",
            ...(unreleasedNote ? [unreleasedNote] : []),
          ]}
          cta="See prices by company size"
          href="#own"
        />
      </ul>

      {/* ---------- Own, by company size ---------- */}
      <div id="own" className="mt-16 scroll-mt-28">
        <h2 className="xw-h3 text-center text-2xl sm:text-3xl">XwiftHQ Own, by company size</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-sm leading-relaxed text-neutral-600 sm:text-base">
          One payment for {modulesLabel(count)}, sized by your headcount when you buy. Care keeps it hosted, updated
          and supported, and the first year of it is included.
        </p>

        <ul className="mt-8 grid gap-5 text-left sm:grid-cols-2 xl:grid-cols-4" aria-label="XwiftHQ Own licences">
          {BANDS.map((band) => {
            const licence = ownLicence(band, list, count);
            const [twelve] = RENT_TO_OWN;
            return (
              <li
                key={band.key}
                className="flex flex-col rounded-[1.25rem] border border-neutral-200/80 bg-white p-6 shadow-[0_1px_2px_rgb(16_18_31/0.04),0_24px_48px_-32px_rgb(150_56_205/0.35)]"
              >
                <h3 className="font-heading text-lg font-semibold tracking-[-0.01em] text-neutral-900">{band.label}</h3>
                <p className="mt-1 text-sm text-neutral-500">{band.range}</p>
                <p className="tnum mt-4 font-heading text-[1.75rem] font-bold tracking-[-0.03em] text-neutral-900">
                  {price(licence)}
                </p>
                <p className="mt-1 text-xs font-medium text-neutral-500">One-time, {modulesLabel(count)}</p>
                <ul className="mt-5 space-y-2.5 text-sm text-neutral-600">
                  <Included>
                    Care <span className="tnum font-semibold text-neutral-800">{price(careYearly(licence))}</span> a
                    year from year two
                  </Included>
                  <Included>
                    Or {twelve.payments} payments of{" "}
                    <span className="tnum font-semibold text-neutral-800">
                      {price(rentToOwnPayment(licence, twelve.payments, twelve.uplift))}
                    </span>
                  </Included>
                </ul>
                <Link
                  href={start("own", { band: band.key })}
                  className="btn-outline mt-6 min-h-11 w-full"
                  aria-label={`Get the ${band.label} licence, ${price(licence)}`}
                >
                  Get this licence
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="mx-auto mt-6 max-w-3xl text-center text-sm leading-relaxed text-neutral-500">
          Above 1,000 employees, Own is quoted from {price(OWN_QUOTE_FROM[list])}. Add modules later and pay only the
          difference inside your band; grow into a bigger band and pay the difference between the two.
        </p>
      </div>

      <p className="mx-auto mt-10 max-w-3xl text-center text-sm leading-relaxed text-neutral-500">
        Prices exclude VAT (7.5% in Nigeria), shown on your invoice. Schools, universities and registered NGOs get 15%
        off the list. Already using XwiftHQ? Your licence stands as sold.{" "}
        <Link
          href="/login?redirect=/suite/org/billing"
          className="rounded font-semibold text-primary-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Log in to add modules
        </Link>
      </p>
    </>
  );
}

function PlanCard({
  eyebrow,
  name,
  price,
  priceNote,
  extra,
  features,
  cta,
  href,
  highlighted = false,
}: {
  eyebrow: string;
  name: string;
  price: string;
  priceNote: string;
  extra?: React.ReactNode;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}) {
  const ctaClass = `mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
    highlighted
      ? "bg-white text-primary-700 hover:bg-primary-50 focus-visible:ring-white focus-visible:ring-offset-primary-600"
      : "border border-neutral-300 bg-white text-neutral-900 hover:border-primary-300 hover:text-primary-700 focus-visible:ring-primary-500"
  }`;

  return (
    <li
      className={`relative flex flex-col rounded-[1.5rem] p-7 ${
        highlighted
          ? "bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 text-white shadow-[0_40px_80px_-36px_rgb(150_56_205/0.8)] lg:py-10"
          : "border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(16_18_31/0.04),0_24px_48px_-32px_rgb(150_56_205/0.35)]"
      }`}
    >
      <p
        className={`self-start rounded-full px-3 py-1 text-xs font-semibold ${
          highlighted ? "bg-white text-primary-700" : "bg-primary-50 text-primary-700"
        }`}
      >
        {eyebrow}
      </p>
      <h3 className={`mt-4 font-heading text-xl font-semibold tracking-[-0.01em] ${highlighted ? "text-white" : "text-neutral-900"}`}>
        {name}
      </h3>
      <p
        className={`tnum mt-3 font-heading text-4xl font-bold tracking-[-0.03em] ${highlighted ? "text-white" : "text-neutral-900"}`}
      >
        {price}
      </p>
      <p className={`mt-1 text-sm ${highlighted ? "text-white/90" : "text-neutral-500"}`}>{priceNote}</p>

      {extra}

      <ul className={`mt-5 space-y-2.5 text-sm ${highlighted ? "text-white/95" : "text-neutral-600"}`}>
        {features.map((f) => (
          <Included key={f} onDark={highlighted}>
            {f}
          </Included>
        ))}
      </ul>

      <div className="mt-auto flex flex-col">
        <Link href={href} className={ctaClass}>
          {cta}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
    </li>
  );
}

export function Included({ children, onDark = false }: { children: React.ReactNode; onDark?: boolean }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          onDark ? "bg-white/20 text-white" : "bg-primary-100 text-primary-700"
        }`}
        aria-hidden="true"
      >
        <Check size={11} strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}
