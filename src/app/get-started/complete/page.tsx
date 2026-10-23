import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingComplete } from "@/components/onboarding/OnboardingComplete";

export const metadata: Metadata = {
  title: "Confirming your payment",
  robots: { index: false, follow: false },
};

/** The payment gateway returns here after checkout. */
export default function OnboardingCompletePage() {
  return (
    <section className="section-padding min-h-screen bg-neutral-50">
      <div className="section-container">
        <Suspense fallback={<div className="mx-auto h-72 max-w-xl animate-pulse rounded-2xl bg-white" />}>
          <OnboardingComplete />
        </Suspense>
      </div>
    </section>
  );
}
