import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import WorkforceBoard from "@/suite/hrm/components/console/WorkforceBoard";

export const metadata: Metadata = {
  title: "Workforce",
  description: "Turnover, tenure, absence and what the untaken leave is worth.",
};

export default function WorkforcePage() {
  return (
    <ManagerOnly>
      <WorkforceBoard />
    </ManagerOnly>
  );
}
