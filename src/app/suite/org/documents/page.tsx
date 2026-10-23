import type { Metadata } from "next";
import DocumentsBoard from "@/suite/org/components/foundations/DocumentsBoard";

export const metadata: Metadata = { title: "Issued documents" };

export default function OrgDocumentsPage() {
  return <DocumentsBoard />;
}
