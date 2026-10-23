import type { Metadata } from "next";
import AuthorityBoard from "@/suite/org/components/approvals/AuthorityBoard";

export const metadata: Metadata = { title: "Approval authority" };

export default function ApprovalAuthorityPage() {
  return <AuthorityBoard />;
}
