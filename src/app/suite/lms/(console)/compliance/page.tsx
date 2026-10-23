import type { Metadata } from "next";
import ComplianceBoard from "@/suite/org/components/ComplianceBoard";

export const metadata: Metadata = {
  title: "Compliance",
  description: "Who has not done the training they were told to do.",
};

export default function CompliancePage() {
  return <ComplianceBoard />;
}
