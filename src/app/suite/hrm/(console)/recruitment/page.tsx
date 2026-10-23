import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import RecruitmentBoard from "@/suite/hrm/components/console/RecruitmentBoard";

export const metadata: Metadata = {
  title: "Recruitment",
  robots: { index: false, follow: false },
};

export default function HrmRecruitmentPage() {
  return (
    <ManagerOnly>
      <RecruitmentBoard />
    </ManagerOnly>
  );
}
