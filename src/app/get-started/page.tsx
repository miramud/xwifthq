import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Sky } from "@/components/site/Sky";
import { lmsFetch } from "@/lib/api/server";
import { DEFAULT_PRICING, normalisePricing, type PublicPricing } from "@/lib/api/public-pricing";

export const metadata: Metadata = {
  title: "Get started",
  description:
    "Bring your organisation onto XwiftHQ in three short steps: pick your modules, tell us who you are, and become the workspace admin.",
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
    <Sky className="pb-20 sm:pb-28">
      <div className="section-container">
        <SectionHeading
          as="h1"
          eyebrow="Get started"
          title="Set up your organisation"
          intro={
            pricing.paymentsEnabled
              ? "Three quick steps. Pay once and you're straight in as your organisation's XwiftHQ admin."
              : "Three quick steps. Send us your request and our team confirms your modules, then switches them on."
          }
          className="mb-10 sm:mb-12"
        />
        {/* useSearchParams needs a Suspense boundary in this Next version. */}
        <Suspense fallback={<div className="xw-frame mx-auto h-96 max-w-5xl animate-pulse motion-reduce:animate-none" />}>
          <OnboardingWizard pricing={pricing} />
        </Suspense>
      </div>
    </Sky>
  );
}
