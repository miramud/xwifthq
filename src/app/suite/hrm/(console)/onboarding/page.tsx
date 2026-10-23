import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import OnboardingBoard from "@/suite/hrm/components/console/OnboardingBoard";

export const metadata: Metadata = {
  title: "Onboarding",
  robots: { index: false, follow: false },
};

export default function HrmOnboardingPage() {
  return (
    <ManagerOnly>
      <OnboardingBoard />
    </ManagerOnly>
  );
}
