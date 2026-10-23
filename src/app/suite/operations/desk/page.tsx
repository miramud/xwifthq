import type { Metadata } from "next";
import ServiceDesk from "@/suite/operations/components/desk/ServiceDesk";

export const metadata: Metadata = { title: "Service desk" };

/** The service desk queue, sorted by priority and SLA. */
export default function Page() {
  return <ServiceDesk />;
}
