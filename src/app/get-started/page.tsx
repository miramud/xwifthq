import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { lmsFetch } from "@/lib/api/server";
import { DEFAULT_PRICING, normalisePricing, type PublicPricing } from "@/lib/api/public-pricing";

export const metadata: Metadata = {
  title: "Get started",
  description: "Set up your organisation on Elevate: choose your modules, tell us who you are, and become its admin.",
  robots: { index: false, follow: true },
};

async function loadPricing(): Promise<PublicPricing> {
  try {
    const result = await lmsFetch("/public/pricing");
    return result.ok ? normalisePricing(result.body) : DEFAULT_PRICING;
  } catch {
    return DEFAULT_PRICING;
  }
}

/** New organisations start here: modules, details, then one payment or a licence request. */
export default async function GetStartedPage() {
  const pricing = await loadPricing();

  return (
    <section className="section-padding min-h-screen bg-neutral-50">
      <div className="section-container">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="label-mono text-neutral-500">Get started</p>
          <h1 className="heading-2 mt-3 text-neutral-900">Set up your organisation</h1>
          <p className="mt-4 text-lg leading-relaxed text-neutral-600">
            {pricing.paymentsEnabled
              ? "Three short steps. Pay once, and you're signed in as your organisation's admin."
              : "Three short steps. Send your request, and our team confirms your modules and switches them on."}
          </p>
        </div>
        {/* useSearchParams needs a Suspense boundary in this Next version. */}
        <Suspense fallback={<div className="mx-auto h-96 max-w-5xl animate-pulse rounded-2xl bg-white" />}>
          <OnboardingWizard pricing={pricing} />
        </Suspense>
      </div>
    </section>
  );
}
