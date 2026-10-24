import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import OverviewBoard from "@/suite/hrm/components/console/OverviewBoard";

export const metadata: Metadata = {
  title: "HR overview",
  robots: { index: false, follow: false },
};

export default function HrmOverviewPage() {
  return (
    <ManagerOnly>
      <OverviewBoard />
    </ManagerOnly>
  );
}
