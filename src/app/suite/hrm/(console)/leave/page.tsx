import type { Metadata } from "next";
import LeaveBoard from "@/suite/hrm/components/console/LeaveBoard";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";

export const metadata: Metadata = {
  title: "Leave",
  robots: { index: false, follow: false },
};

export default function HrmLeavePage() {
  return (
    <ManagerOnly>
      <LeaveBoard />
    </ManagerOnly>
  );
}
