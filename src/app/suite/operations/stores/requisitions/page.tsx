import type { Metadata } from "next";
import RequisitionsDesk from "@/suite/operations/components/stores/RequisitionsDesk";

export const metadata: Metadata = { title: "Requisitions" };

/** The issue desk: approved requisitions first. */
export default function RequisitionsPage() {
  return <RequisitionsDesk />;
}
