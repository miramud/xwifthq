import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import TimesheetBoard from "@/suite/hrm/components/console/TimesheetBoard";

export const metadata: Metadata = {
  title: "Timesheets",
  robots: { index: false, follow: false },
};

export default function HrmTimesheetsPage() {
  return (
    <ManagerOnly>
      <TimesheetBoard />
    </ManagerOnly>
  );
}
