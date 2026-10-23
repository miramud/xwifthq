import type { Metadata } from "next";
import ClaimsDesk from "@/suite/operations/components/maintenance/ClaimsDesk";

export const metadata: Metadata = { title: "Insurance claims" };

export default function InsuranceClaimsPage() {
  return <ClaimsDesk />;
}
