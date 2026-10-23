import type { Metadata } from "next";
import RenewalsBoard from "@/suite/hrm/components/console/RenewalsBoard";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";

export const metadata: Metadata = {
  title: "Renewals",
  robots: { index: false, follow: false },
};

/*
  Manager-gated. It is a list of other people's registrations and visas, which
  is exactly the sort of thing that should not be browsable by everybody who
  happens to hold a login.
*/
export default function HrmRenewalsPage() {
  return (
    <ManagerOnly>
      <RenewalsBoard />
    </ManagerOnly>
  );
}
