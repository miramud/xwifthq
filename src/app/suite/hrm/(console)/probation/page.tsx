import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import ProbationBoard from "@/suite/hrm/components/console/ProbationBoard";

export const metadata: Metadata = {
  title: "Probation",
  robots: { index: false, follow: false },
};

export default function HrmProbationPage() {
  return (
    <ManagerOnly>
      <ProbationBoard />
    </ManagerOnly>
  );
}
