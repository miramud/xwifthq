import type { Metadata } from "next";
import InternshipsBoard from "@/suite/hrm/components/console/InternshipsBoard";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";

export const metadata: Metadata = {
  title: "Internships",
  robots: { index: false, follow: false },
};

export default function HrmInternshipsPage() {
  return (
    <ManagerOnly>
      <InternshipsBoard />
    </ManagerOnly>
  );
}
