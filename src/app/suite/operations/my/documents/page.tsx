import type { Metadata } from "next";
import MyDocuments from "@/suite/operations/components/my-documents/MyDocuments";

export const metadata: Metadata = { title: "Documents" };

/** Search the organisation's documents and download them. */
export default function MyDocumentsPage() {
  return <MyDocuments />;
}
