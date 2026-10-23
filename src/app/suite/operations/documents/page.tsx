import type { Metadata } from "next";
import RepositoryDesk from "@/suite/operations/components/documents/RepositoryDesk";

export const metadata: Metadata = { title: "Document repository" };

/** Everything the organisation keeps, found by what it says. */
export default function DocumentRepositoryPage() {
  return <RepositoryDesk />;
}
