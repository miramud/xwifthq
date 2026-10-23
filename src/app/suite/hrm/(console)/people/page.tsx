import type { Metadata } from "next";
import Directory from "@/suite/hrm/components/console/Directory";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";

export const metadata: Metadata = {
  title: "Directory",
  robots: { index: false, follow: false },
};

export default function HrmDirectoryPage() {
  return (
    <ManagerOnly>
      <Directory />
    </ManagerOnly>
  );
}
