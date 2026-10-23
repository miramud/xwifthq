import type { Metadata } from "next";
import RolesBoard from "@/suite/org/components/approvals/RolesBoard";

export const metadata: Metadata = { title: "Approval roles" };

export default function ApprovalRolesPage() {
  return <RolesBoard />;
}
