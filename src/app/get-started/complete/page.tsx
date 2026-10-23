import type { Metadata } from "next";
import { Suspense } from "react";
import { OnboardingComplete } from "@/components/onboarding/OnboardingComplete";
import { Clouds } from "@/components/site/Sky";

export const metadata: Metadata = {
  title: "Confirming your payment",
  robots: { index: false, follow: false },
};

/**
 * The payment gateway returns here after checkout. The navbar sits above this
 * page rather than floating over it, so the sky needs no top clearance.
 */
export default function OnboardingCompletePage() {
  return (
    <section className="xw-sky relative isolate min-h-[80vh] overflow-hidden py-16 sm:py-24">
      <Clouds className="-z-10" />
      <div className="section-container">
        <Suspense fallback={<div className="xw-frame mx-auto h-72 max-w-xl animate-pulse motion-reduce:animate-none" />}>
          <OnboardingComplete />
        </Suspense>
      </div>
    </section>
  );
}
