import type { Metadata } from "next";
import MyPurchaseRequests from "@/suite/operations/components/my-requests/MyPurchaseRequests";

export const metadata: Metadata = { title: "My purchase requests" };

/** Everybody's own purchase requests. */
export default function MyPurchaseRequestsPage() {
  return <MyPurchaseRequests />;
}
