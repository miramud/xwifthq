import type { Metadata } from "next";
import StructureBoard from "@/suite/org/components/foundations/StructureBoard";

export const metadata: Metadata = { title: "Structure" };

export default function OrgStructurePage() {
  return <StructureBoard />;
}
