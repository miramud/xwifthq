import type { Metadata } from "next";
import MyRequestsBoard from "@/suite/finance/components/requests/MyRequestsBoard";

export const metadata: Metadata = { title: "My requests" };

/** Everybody's own payment and advance requests. */
export default function MyRequestsPage() {
  return <MyRequestsBoard />;
}
