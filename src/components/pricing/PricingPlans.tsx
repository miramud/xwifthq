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
 * The three ways to buy Elevate: modules once, the whole codebase, or a
 * server of your own.
 *
 * The module ladder's signature is the stack of rising bars on each card — the
 * mark's ascending rectangles, filled for the modules the tier buys. It is the
 * one decorative element here, and it carries a fact (how many modules), so it
 * earns its place rather than decorating the price.
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
            className="inline-flex rounded-full border border-neutral-200 bg-white p-1 shadow-sm"
          >
            {pricing.currencies.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={currency === c}
                onClick={() => setCurrency(c)}
                className={`min-h-11 rounded-full px-5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
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
      <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Module bundles, one-time price">
        {TIERS.map((tier) => {
          const count = Number(tier);
          const price = pricing.ladder[currency][tier];
          const saving = savingFor(pricing, tier, currency);
          const highlighted = tier === HIGHLIGHT;
          const includesComingSoon = count > liveCount && comingSoon.length > 0;

          return (
            <li
              key={tier}
              className={`relative flex flex-col rounded-2xl border bg-white p-6 transition-shadow duration-200 ${
                highlighted
                  ? "border-primary-500 shadow-xl shadow-primary-600/10 ring-2 ring-primary-500 xl:-mt-3 xl:mb-3"
                  : "border-neutral-200 shadow-sm hover:shadow-md"
              }`}
            >
              {highlighted && (
                <span className="label-mono absolute -top-3 left-6 rounded-full bg-primary-600 px-3 py-1 text-white">
                  Every live module
                </span>
              )}

              <ModuleBars count={count} />

              <h3 className="font-heading mt-5 text-lg font-semibold text-neutral-900">
                {count} {count === 1 ? "module" : "modules"}
              </h3>

              <p className="mt-3 flex items-baseline gap-2">
                <span className="font-heading text-3xl font-bold tracking-tight text-neutral-900 tabular-nums">
                  {formatMoney(price, currency)}
                </span>
              </p>
              <p className="label-mono mt-1 text-neutral-500">One-time · yours to keep</p>

              <p className="mt-4 text-sm text-neutral-600">
                <span className="font-semibold text-neutral-800 tabular-nums">
                  {formatCompactMoney(Math.round(price / count), currency)}
                </span>{" "}
                per module
                {saving > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-primary-700">
                      save {formatCompactMoney(saving, currency)}
                    </span>
                  </>
                )}
              </p>

              <ul className="mt-5 space-y-2.5 text-sm text-neutral-600">
                <Included>Any {count === 1 ? "one module" : `${count} modules`} you choose</Included>
                <Included>Users, roles &amp; permissions, audit log, recycle bin</Included>
                <Included>Your own storage, AI, email and messaging</Included>
                {includesComingSoon && (
                  <Included muted>{comingSoon.join(" and ")} delivered when released</Included>
                )}
              </ul>

              <Link
                href={`/get-started?count=${count}&currency=${currency}`}
                className={`mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
                  highlighted
                    ? "bg-primary-600 text-white hover:bg-primary-700"
                    : "border border-neutral-300 text-neutral-800 hover:border-primary-500 hover:text-primary-700"
                }`}
                aria-label={`Get started — ${count} ${count === 1 ? "module" : "modules"}, ${formatMoney(price, currency)}`}
              >
                Get started
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mx-auto mt-6 max-w-3xl text-center text-sm text-neutral-500">
        {pricing.paymentsEnabled ? (
          <>
            Already on Elevate? Add modules from Plan &amp; billing and pay only the difference between your bundle and
            the next.
          </>
        ) : (
          <>
            Nothing is charged online: choose a bundle and send us a request, and our team confirms your modules,
            invoices the one-time price and switches them on. Already on Elevate? Request more from Plan &amp; billing.
          </>
        )}{" "}
        <Link href="/login?redirect=/suite/org/billing" className="font-medium text-primary-700 underline-offset-2 hover:underline">
          Sign in to add modules
        </Link>
      </p>

      {/* ---------- ownership and hosting ---------- */}
      <div className="mt-16 grid gap-6 lg:grid-cols-5">
        <article className="relative overflow-hidden rounded-2xl bg-primary-900 p-8 text-white shadow-xl lg:col-span-3 sm:p-10">
          <svg
            className="pointer-events-none absolute -right-6 bottom-0 h-56 w-56 opacity-[0.12]"
            viewBox="0 0 200 200"
            aria-hidden="true"
          >
            <g fill="currentColor">
              <rect x="10" y="130" width="30" height="60" rx="5" />
              <rect x="55" y="95" width="30" height="95" rx="5" />
              <rect x="100" y="55" width="30" height="135" rx="5" />
              <rect x="145" y="10" width="30" height="180" rx="5" />
            </g>
          </svg>
          <div className="relative">
            <p className="label-mono flex items-center gap-2 text-accent-400">
              <Code2 size={14} aria-hidden="true" />
              Full ownership
            </p>
            <h3 className="font-heading mt-3 text-3xl font-semibold tracking-tight">The full source code</h3>
            <p className="mt-3 max-w-xl leading-relaxed text-white/80">
              Every module and the spine beneath them, as a codebase you own. Run it on your own infrastructure,
              change it to fit how you work, and keep it for as long as you like.
            </p>
            <p className="mt-6 font-heading text-4xl font-bold tracking-tight tabular-nums">
              {formatMoney(pricing.sourceCode[currency], currency)}
            </p>
            <p className="label-mono mt-1 text-white/60">One-time · licence and handover</p>
            <ul className="mt-6 grid gap-2.5 text-sm text-white/85 sm:grid-cols-2">
              <Included onDark>All five modules, including Finance and Admin as they ship</Included>
              <Included onDark>Deploy anywhere — your servers, your cloud</Included>
              <Included onDark>Licence agreement and code handover</Included>
              <Included onDark>Change anything to fit how you work</Included>
            </ul>
            <button
              type="button"
              onClick={() => setRequest("source_code")}
              className="btn-accent mt-8 min-h-11 gap-2"
            >
              Request the source code
              <ArrowRight size={16} aria-hidden="true" />
            </button>
            <p className="mt-3 text-xs text-white/60">By request — our team sends the agreement and invoice.</p>
          </div>
        </article>

        <article className="flex flex-col rounded-2xl border border-neutral-200 bg-white p-8 shadow-sm lg:col-span-2 sm:p-10">
          <p className="label-mono flex items-center gap-2 text-primary-700">
            <Server size={14} aria-hidden="true" />
            Add-on
          </p>
          <h3 className="font-heading mt-3 text-2xl font-semibold tracking-tight text-neutral-900">
            A dedicated server and your own domain
          </h3>
          <p className="mt-3 leading-relaxed text-neutral-600">
            Your organisation&apos;s data on a server of its own, at an address on your domain. It carries a
            yearly cost, sized to your organisation — our technical team arranges it with you and walks with
            you all the way to go-live.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm text-neutral-600">
            <Included>Isolated server for your data</Included>
            <Included>Custom domain, e.g. elevate.yourcompany.com</Included>
            <Included>Set up and migrated by our technical team</Included>
          </ul>
          <p className="label-mono mt-6 text-neutral-500">Billed yearly · quoted per organisation</p>
          <button
            type="button"
            onClick={() => setRequest("dedicated_hosting")}
            className="btn-outline mt-auto min-h-11 gap-2 self-start"
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
function ModuleBars({ count }: { count: number }) {
  return (
    <div className="flex h-10 items-end gap-1.5" role="img" aria-label={`${count} of 5 modules`}>
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={`w-3 rounded-sm ${i < count ? "bg-primary-600" : "border border-dashed border-neutral-300 bg-neutral-50"}`}
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
    <li className={`flex items-start gap-2.5 ${muted ? "text-neutral-500" : ""}`}>
      <Check
        size={16}
        className={`mt-0.5 shrink-0 ${onDark ? "text-accent-400" : muted ? "text-neutral-400" : "text-primary-600"}`}
        aria-hidden="true"
      />
      <span>{children}</span>
    </li>
  );
}
