import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import { TeamReviewsBoard } from "@/suite/hrm/components/console/MyTeam";

export const metadata: Metadata = {
  title: "Team reviews",
  robots: { index: false, follow: false },
};

/*
  My team (S9). `ManagerOnly` reads the path: team pages open to Supervisors
  and HR managers (`mayOpenTeam` in hrm-access), not by HR permission keys.
*/
export default function TeamReviewsPage() {
  return (
    <ManagerOnly>
      <TeamReviewsBoard />
    </ManagerOnly>
  );
}
