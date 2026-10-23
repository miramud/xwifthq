import type { Metadata } from "next";
import CountsDesk from "@/suite/operations/components/stores/CountsDesk";

export const metadata: Metadata = { title: "Stock counts" };

/** Full and cycle counts, and the ones waiting for someone else to approve. */
export default function CountsPage() {
  return <CountsDesk />;
}
