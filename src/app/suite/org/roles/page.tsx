import type { Metadata } from "next";
import RolesBoard from "@/suite/org/components/roles/RolesBoard";

export const metadata: Metadata = { title: "Roles & permissions" };

export default function RolesPage() {
  return <RolesBoard />;
}
