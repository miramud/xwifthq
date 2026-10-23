"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, Code2, Server } from "lucide-react";
import { SalesRequestDialog } from "./SalesRequestDialog";
import {
  TIERS,
  formatCompactMoney,
  formatMoney,
  savingFor,
  type Currency,
  type PublicPricing,
  type SalesRequestType,
  type Tier,
} from "@/lib/api/public-pricing";

/** The tier we point people at: every module that ships today. */
const HIGHLIGHT: Tier = "3";

const CURRENCY_LABEL: Record<Currency, string> = { NGN: "Naira", USD: "US dollars" };

/**
 * The three ways to buy XwiftHQ: modules once, the whole codebase, or a
 * server of your own.
 *
 * The module ladder is a row of clean white cards with the recommended bundle
 * filled in purple. Each card carries a small stack of rising bars, filled for
 * the modules the tier buys, so the one decorative element states a fact.
 */
export function PricingPlans({ pricing }: { pricing: PublicPricing }) {
  const [currency, setCurrency] = useState<Currency>(pricing.currencies[0] ?? "NGN");
  const [request, setRequest] = useState<SalesRequestType | null>(null);

  const liveCount = pricing.modules.filter((m) => m.status === "available").length;
  const comingSoon = pricing.modules.filter((m) => m.status === "coming_soon").map((m) => m.label);

  return (
    <>
      {/* ---------- currency ---------- */}
      {pricing.currencies.length > 1 && (
        <div className="flex justify-center">
          <div
            role="radiogroup"
            aria-label="Currency"
            className="inline-flex rounded-full border border-primary-100 bg-white p-1 shadow-[0_10px_30px_-18px_rgb(150_56_205/0.5)]"
          >
            {pricing.currencies.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setCurrency(c)}
                className={`min-h-11 rounded-full px-4 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 sm:px-5 ${
                  currency === c ? "bg-primary-600 text-white" : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {CURRENCY_LABEL[c]} ({c === "NGN" ? "₦" : "$"})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ---------- the module ladder ---------- */}
      <ol
        className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 xl:items-center"
        aria-label="Module bundles, one-time price"
      >
        {TIERS.map((tier) => {
          const count = Number(tier);
          const price = pricing.ladder[currency][tier];
          const saving = savingFor(pricing, tier, currency);
          const highlighted = tier === HIGHLIGHT;
          const includesComingSoon = count > liveCount && comingSoon.length > 0;
          const name = `${count} ${count === 1 ? "module" : "modules"}`;

          return (
            <li
              key={tier}
              className={`relative flex flex-col rounded-[1.25rem] p-6 ${
                highlighted
                  ? "bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 text-white shadow-[0_40px_80px_-36px_rgb(150_56_205/0.8)] xl:py-9"
                  : "border border-neutral-200/80 bg-white shadow-[0_1px_2px_rgb(16_18_31/0.04),0_24px_48px_-32px_rgb(150_56_205/0.35)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <ModuleBars count={count} onDark={highlighted} />
                {highlighted && (
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary-700">
                    Every live module
                  </span>
                )}
              </div>

              <h3
                className={`mt-5 font-heading text-lg font-semibold tracking-[-0.01em] ${highlighted ? "text-white" : "text-neutral-900"}`}
              >
                {name}
              </h3>

              <p
                className={`tnum mt-3 font-heading text-3xl font-bold tracking-[-0.03em] xl:text-[1.6rem] ${
                  highlighted ? "text-white" : "text-neutral-900"
                }`}
              >
                {formatMoney(price, currency)}
              </p>
              <p className={`mt-1 text-xs font-medium ${highlighted ? "text-white/90" : "text-neutral-500"}`}>
                One-time payment, yours to keep
              </p>

              <p className={`mt-4 text-sm ${highlighted ? "text-white/95" : "text-neutral-600"}`}>
                <span className={`tnum font-semibold ${highlighted ? "text-white" : "text-neutral-800"}`}>
                  {formatCompactMoney(Math.round(price / count), currency)}
                </span>{" "}
                per module
                {saving > 0 && (
                  <>
                    {" · "}
                    <span className={`font-semibold ${highlighted ? "text-white" : "text-primary-700"}`}>
                      save {formatCompactMoney(saving, currency)}
                    </span>
                  </>
                )}
              </p>

              <ul className={`mt-5 space-y-2.5 text-sm ${highlighted ? "text-white/95" : "text-neutral-600"}`}>
                <Included onDark={highlighted}>Any {count === 1 ? "one module" : `${count} modules`} you choose</Included>
                <Included onDark={highlighted}>Users, roles and permissions, audit log, recycle bin</Included>
                <Included onDark={highlighted}>Your own storage, AI, email and messaging</Included>
                {includesComingSoon && (
                  <Included onDark={highlighted} muted>
                    {comingSoon.join(" and ")} switched on when released
                  </Included>
                )}
              </ul>

              <Link
                href={`/get-started?count=${count}&currency=${currency}`}
                className={`mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  highlighted
                    ? "bg-white text-primary-700 hover:bg-primary-50 focus-visible:ring-white focus-visible:ring-offset-primary-600"
                    : "border border-neutral-300 bg-white text-neutral-900 hover:border-primary-300 hover:text-primary-700 focus-visible:ring-primary-500"
                }`}
                aria-label={`Get started with ${name}, ${formatMoney(price, currency)}`}
              >
                Get started
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-neutral-500">
        {pricing.paymentsEnabled ? (
          <>
            Already using XwiftHQ? Add modules from Plan and billing and pay only the difference between your bundle
            and the next.
          </>
        ) : (
          <>
            Nothing is charged online: choose a bundle and send us a request, and our team confirms your modules,
            invoices the one-time price and switches them on. Already using XwiftHQ? Request more from Plan and
            billing.
          </>
        )}{" "}
        <Link
          href="/login?redirect=/suite/org/billing"
          className="rounded font-semibold text-primary-700 underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        >
          Log in to add modules
        </Link>
      </p>

      {/* ---------- ownership and hosting ---------- */}
      <div className="mt-16 grid gap-5 text-left lg:grid-cols-5">
        <article className="relative isolate overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary-400 via-primary-500 to-primary-700 p-7 text-white shadow-[0_40px_80px_-40px_rgb(150_56_205/0.8)] sm:p-10 lg:col-span-3">
          <span className="xw-cloud -right-20 -top-12 -z-10 h-40 w-96 opacity-20" aria-hidden="true" />
          <span className="xw-cloud -bottom-16 -left-16 -z-10 h-40 w-80 opacity-15" aria-hidden="true" />
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
            <Code2 size={14} aria-hidden="true" />
            Full ownership
          </p>
          <h3 className="mt-4 font-heading text-2xl font-bold tracking-[-0.025em] sm:text-3xl">The full source code</h3>
          <p className="mt-3 max-w-xl leading-relaxed text-white/90">
            Every module and the shared foundation beneath them, handed to you as a codebase you own. Host it where
            you like, shape it around how your company works, and keep it as long as you need.
          </p>
          <p className="tnum mt-6 font-heading text-4xl font-bold tracking-[-0.03em]">
            {formatMoney(pricing.sourceCode[currency], currency)}
          </p>
          <p className="mt-1 text-xs font-medium text-white/90">One-time, with a licence and full handover</p>
          <ul className="mt-6 grid gap-2.5 text-sm text-white/95 sm:grid-cols-2">
            <Included onDark>All five modules, with Finance and Admin as they ship</Included>
            <Included onDark>Deploy on your own servers or cloud</Included>
            <Included onDark>Licence agreement and code handover</Included>
            <Included onDark>Change anything to fit your processes</Included>
          </ul>
          <button
            type="button"
            onClick={() => setRequest("source_code")}
            className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary-600"
          >
            Request the source code
            <ArrowRight size={16} aria-hidden="true" />
          </button>
          <p className="mt-3 text-xs text-white/90">By request. Our team sends the agreement and the invoice.</p>
        </article>

        <article className="xw-glow-card flex flex-col p-7 sm:p-10 lg:col-span-2">
          <p className="xw-eyebrow self-start">
            <Server size={14} aria-hidden="true" />
            Add-on
          </p>
          <h3 className="mt-4 font-heading text-2xl font-bold tracking-[-0.025em] text-neutral-900">
            A dedicated server on your own domain
          </h3>
          <p className="mt-3 leading-relaxed text-neutral-600">
            Your company&apos;s data on a server of its own, at an address you choose. It is billed yearly and sized
            to your organisation, and our technical team stays with you from setup to go-live.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-neutral-600">
            <Included>An isolated server for your data</Included>
            <Included>Your own address, such as hq.yourcompany.com</Included>
            <Included>Set up and migrated by our technical team</Included>
          </ul>
          <p className="mt-6 text-xs font-medium text-neutral-500">Billed yearly, quoted per organisation</p>
          <button
            type="button"
            onClick={() => setRequest("dedicated_hosting")}
            className="btn-outline mt-6 min-h-11 self-start lg:mt-auto"
          >
            Talk to the technical team
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </article>
      </div>

      <SalesRequestDialog
        type={request ?? "enterprise"}
        open={request !== null}
        onClose={() => setRequest(null)}
        currency={currency}
      />
    </>
  );
}

/** Five rising bars; the first `count` are filled. Read as "n of 5 modules". */
function ModuleBars({ count, onDark = false }: { count: number; onDark?: boolean }) {
  return (
    <div className="flex h-10 items-end gap-1.5" role="img" aria-label={`${count} of 5 modules`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-3 rounded-full ${
            i < count
              ? onDark
                ? "bg-white"
                : "bg-primary-600"
              : onDark
                ? "bg-white/20"
                : "bg-primary-100"
          }`}
          style={{ height: `${36 + i * 16}%` }}
        />
      ))}
    </div>
  );
}

function Included({
  children,
  muted = false,
  onDark = false,
}: {
  children: React.ReactNode;
  muted?: boolean;
  onDark?: boolean;
}) {
  return (
    <li className={`flex items-start gap-2.5 ${muted ? (onDark ? "text-white/90" : "text-neutral-500") : ""}`}>
      <span
        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
          onDark ? "bg-white/20 text-white" : muted ? "bg-neutral-100 text-neutral-400" : "bg-primary-100 text-primary-700"
        }`}
        aria-hidden="true"
      >
        <Check size={11} strokeWidth={3} />
      </span>
      <span>{children}</span>
    </li>
  );
}
