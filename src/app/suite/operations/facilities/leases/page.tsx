import type { Metadata } from "next";
import LeasesBoard from "@/suite/operations/components/facilities/LeasesBoard";

export const metadata: Metadata = { title: "Leases" };

/** Every lease on one expiry timeline, with each rent schedule. */
export default function Page() {
  return <LeasesBoard />;
}
