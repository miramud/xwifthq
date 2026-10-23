import type { Metadata } from "next";
import ContractsBoard from "@/suite/hrm/components/console/ContractsBoard";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";

export const metadata: Metadata = {
  title: "Contracts",
  robots: { index: false, follow: false },
};

export default function HrmContractsPage() {
  return (
    <ManagerOnly>
      <ContractsBoard />
    </ManagerOnly>
  );
}
