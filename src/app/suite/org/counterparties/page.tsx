import type { Metadata } from "next";
import CounterpartiesBoard from "@/suite/org/components/foundations/CounterpartiesBoard";

export const metadata: Metadata = { title: "Clients and vendors" };

export default function OrgCounterpartiesPage() {
  return <CounterpartiesBoard />;
}
