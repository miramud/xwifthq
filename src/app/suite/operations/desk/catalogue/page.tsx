import type { Metadata } from "next";
import CatalogueEditor from "@/suite/operations/components/desk/CatalogueEditor";

export const metadata: Metadata = { title: "Request catalogue" };

/** What staff can ask for, each with its form, owner, SLA and route. */
export default function Page() {
  return <CatalogueEditor />;
}
