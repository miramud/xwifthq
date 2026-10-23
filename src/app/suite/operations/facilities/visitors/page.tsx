import type { Metadata } from "next";
import VisitorsDesk from "@/suite/operations/components/facilities/VisitorsDesk";

export const metadata: Metadata = { title: "Visitors" };

/** Reception: who is expected, in the building, and gone. */
export default function Page() {
  return <VisitorsDesk />;
}
