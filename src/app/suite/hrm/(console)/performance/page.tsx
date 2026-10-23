import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import PerformanceBoard from "@/suite/hrm/components/console/PerformanceBoard";

export const metadata: Metadata = {
  title: "Performance",
  robots: { index: false, follow: false },
};

export default function HrmPerformancePage() {
  return (
    <ManagerOnly>
      <PerformanceBoard />
    </ManagerOnly>
  );
}
