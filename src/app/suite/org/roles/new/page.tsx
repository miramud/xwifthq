import type { Metadata } from "next";
import RoleEditor from "@/suite/org/components/roles/RoleEditor";

export const metadata: Metadata = { title: "New role" };

export default function NewRolePage() {
  return <RoleEditor id={null} />;
}
