import Link from "next/link";
import { Check, ShieldCheck } from "lucide-react";

import { XwiftLockup } from "@/components/shared/BrandLogo";

/**
 * The frame every sign in page shares: the form on white at the left, and a
 * purple sky panel at the right that shows what the person is signing in to.
 * The marketing navbar and footer stay off these routes (see SiteChrome), so
 * the logo here is the way back home.
 */

const POINTS = [
  "Finance, operations, people, projects and learning",
  "One approvals inbox for every request",
  "A full audit trail behind every change",
];

function SidePanel() {
  return (
    <div className="relative isolate hidden overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-300 via-primary-500 to-primary-700 p-10 lg:flex lg:flex-col xl:p-14">
      <span className="xw-cloud -left-16 top-10 -z-10 h-40 w-96 opacity-30" aria-hidden="true" />
      <span className="xw-cloud -right-20 bottom-24 -z-10 h-48 w-[30rem] opacity-25" aria-hidden="true" />

      <p className="inline-flex w-fit items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
        Secure workspace sign in
      </p>
      <h2 className="mt-6 max-w-md font-heading text-3xl font-bold leading-tight tracking-[-0.025em] text-white xl:text-4xl">
        Your whole company, one login away.
      </h2>
      <ul className="mt-6 space-y-3">
        {POINTS.map((point) => (
          <li key={point} className="flex items-center gap-3 text-sm text-primary-50">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20" aria-hidden="true">
              <Check className="h-3 w-3 text-white" />
            </span>
            {point}
          </li>
        ))}
      </ul>

      {/* A glimpse of the inbox waiting on the other side. Decorative. */}
      <div className="relative mt-auto pt-12" aria-hidden="true">
        <div className="absolute -top-0 right-6 w-56 rotate-3 rounded-2xl bg-white/90 p-4 shadow-xl backdrop-blur">
          <p className="text-[11px] font-semibold text-neutral-900">Who is in today</p>
          <div className="mt-3 space-y-2.5">
            {[
              ["AO", "bg-coral-500", "In today"],
              ["TB", "bg-sky-500", "On leave"],
              ["MI", "bg-mint-500", "Onboarding"],
            ].map(([initials, tone, status]) => (
              <div key={initials} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-semibold text-white ${tone}`}>
                  {initials}
                </span>
                <span className="h-2 w-16 rounded-full bg-neutral-200" />
                <span className="ml-auto text-[9px] text-neutral-500">{status}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-16 w-72 rounded-2xl bg-white p-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-neutral-900">Your approvals</p>
            <span className="rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-semibold text-white">4</span>
          </div>
          <div className="mt-3 rounded-xl border border-neutral-200 p-3">
            <span className="rounded bg-accent-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent-700">Finance</span>
            <p className="mt-2 text-xs font-semibold text-neutral-900">Q4 travel advance</p>
            <p className="text-[10px] text-neutral-500">Second approval needed</p>
          </div>
          <div className="mt-3 flex gap-2">
            <span className="flex-1 rounded-full bg-primary-600 py-1.5 text-center text-[10px] font-semibold text-white">Approve</span>
            <span className="flex-1 rounded-full border border-neutral-200 py-1.5 text-center text-[10px] font-semibold text-neutral-700">Review</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <section className="min-h-screen bg-white p-3 sm:p-4">
      <div className="grid min-h-[calc(100vh-1.5rem)] gap-4 sm:min-h-[calc(100vh-2rem)] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        <div className="flex flex-col px-4 py-6 sm:px-10 lg:px-14">
          <Link href="/" aria-label="XwiftHQ home" className="w-fit rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <XwiftLockup markClassName="h-9 w-9" wordClassName="text-2xl" />
          </Link>

          <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">{children}</div>

          <p className="text-center text-xs text-neutral-500 lg:text-left">
            &copy; 2026 XwiftHQ.{" "}
            <Link href="/support" className="font-medium text-neutral-600 hover:text-primary-700">
              Need help signing in?
            </Link>
          </p>
        </div>

        <SidePanel />
      </div>
    </section>
  );
}

/** The heading block at the top of an auth form. */
export function AuthHeading({ title, intro }: { title: string; intro?: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h1 className="font-heading text-[2rem] font-bold leading-tight tracking-[-0.03em] text-neutral-900">{title}</h1>
      {intro && <p className="mt-2 text-sm leading-relaxed text-neutral-600">{intro}</p>}
    </div>
  );
}

/** Shared input styling for the auth forms. */
export const AUTH_INPUT =
  "h-12 w-full rounded-xl border border-neutral-200 bg-white pl-11 pr-4 text-sm text-neutral-900 placeholder-neutral-400 transition-colors focus:border-primary-400 focus:outline-none focus:ring-4 focus:ring-primary-100";
