import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import RosterBoard from "@/suite/hrm/components/console/RosterBoard";

export const metadata: Metadata = {
  title: "Roster",
  robots: { index: false, follow: false },
};

export default function HrmRosterPage() {
  return (
    <ManagerOnly>
      <RosterBoard />
    </ManagerOnly>
  );
}
