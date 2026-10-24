import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import OffboardingBoard from "@/suite/hrm/components/console/OffboardingBoard";

export const metadata: Metadata = {
  title: "Leavers",
  description: "Departures, clearance lists and anything not yet returned.",
};

export default function LeaversPage() {
  return (
    <ManagerOnly>
      <OffboardingBoard />
    </ManagerOnly>
  );
}
