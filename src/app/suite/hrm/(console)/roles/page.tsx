import type { Metadata } from "next";
import HrRolesBoard from "@/suite/hrm/components/console/HrRolesBoard";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";

export const metadata: Metadata = {
  title: "HR roles",
  description: "Give and take the organisation's roles from HR, and see who holds each.",
  robots: { index: false, follow: false },
};

/** HR's roles board (roles redesign, phase 3a); `/suite/hrm/designations` redirects here. */
export default function HrRolesPage() {
  return (
    <ManagerOnly>
      <HrRolesBoard />
    </ManagerOnly>
  );
}
