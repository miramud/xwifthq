import type { Metadata } from "next";
import ReceivingDesk from "@/suite/operations/components/procurement/ReceivingDesk";

export const metadata: Metadata = { title: "Receiving & invoices" };

/** GRNs, SCCs and vendor invoices with their three-way match. */
export default function ReceivingPage() {
  return <ReceivingDesk />;
}
