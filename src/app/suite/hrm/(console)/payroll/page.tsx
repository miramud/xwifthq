import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import PayrollBoard from "@/suite/hrm/components/console/PayrollBoard";

export const metadata: Metadata = {
  title: "Payroll",
  robots: { index: false, follow: false },
};

export default function HrmPayrollPage() {
  return (
    <ManagerOnly>
      <PayrollBoard />
    </ManagerOnly>
  );
}
