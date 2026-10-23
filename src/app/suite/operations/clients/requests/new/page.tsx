import type { Metadata } from "next";
import NewClientPayment from "@/suite/operations/components/clients/NewClientPayment";

export const metadata: Metadata = { title: "New client payment request" };

/** Prepare a request from an issued invoice, or by hand. */
export default function NewClientPaymentPage() {
  return <NewClientPayment />;
}
