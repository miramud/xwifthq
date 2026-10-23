import type { Metadata } from "next";
import ComplianceDesk from "@/suite/operations/components/compliance/ComplianceDesk";

export const metadata: Metadata = { title: "Compliance" };

/** Statutory filings, remittances and certificates: the register, the calendar and the certificates' validity. */
export default function CompliancePage() {
  return <ComplianceDesk />;
}
