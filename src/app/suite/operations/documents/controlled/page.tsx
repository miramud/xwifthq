import type { Metadata } from "next";
import ControlledList from "@/suite/operations/components/documents/ControlledList";

export const metadata: Metadata = { title: "Policies and SOPs" };

/** Controlled documents: the version in force, reviews, and who has read it. */
export default function ControlledDocumentsPage() {
  return <ControlledList />;
}
