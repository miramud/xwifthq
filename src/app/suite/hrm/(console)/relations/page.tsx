import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import RelationsBoard from "@/suite/hrm/components/console/RelationsBoard";

export const metadata: Metadata = {
  title: "Employee relations",
  description: "Disciplinaries, grievances and live warnings.",
};

export default function RelationsPage() {
  return (
    <ManagerOnly>
      <RelationsBoard />
    </ManagerOnly>
  );
}
