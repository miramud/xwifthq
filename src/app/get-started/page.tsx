import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SectionHeading } from "@/components/site/SectionHeading";
import { Sky } from "@/components/site/Sky";
import { lmsFetch } from "@/lib/api/server";
import { DEFAULT_PRICING, normalisePricing, type PublicModule } from "@/lib/api/public-pricing";

export const metadata: Metadata = {
  title: "Get started",
  description:
    "Bring your organisation onto XwiftHQ in three short steps: choose Free, Cloud or Own, tell us who you are, and become the workspace admin.",
  robots: { index: false, follow: true },
};

/** The modules and whether each is released; the prices come from the price book, not the API. */
async function loadModules(): Promise<PublicModule[]> {
  try {
    const result = await lmsFetch("/public/pricing");
    return (result.ok ? normalisePricing(result.body) : DEFAULT_PRICING).modules;
  } catch {
    return DEFAULT_PRICING.modules;
  }
}

/** New organisations start here: a plan, their details, then a request the team sets up. */
export default async function GetStartedPage() {
  const modules = await loadModules();

  return (
    <Sky className="pb-20 sm:pb-28">
      <div className="section-container">
        <SectionHeading
          as="h1"
          eyebrow="Get started"
          title="Set up your organisation"
          intro="Three quick steps. Choose how you want to run XwiftHQ, tell us who you are, and our team sets up your workspace."
          className="mb-10 sm:mb-12"
        />
        {/* useSearchParams needs a Suspense boundary in this Next version. */}
        <Suspense fallback={<div className="xw-frame mx-auto h-96 max-w-5xl animate-pulse motion-reduce:animate-none" />}>
          <OnboardingWizard modules={modules} />
        </Suspense>
      </div>
    </Sky>
  );
}
