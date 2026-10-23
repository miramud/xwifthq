import type { Metadata } from "next";
import PolicyTable from "@/suite/operations/components/travel/PolicyTable";

export const metadata: Metadata = { title: "Travel policy" };

/** The rates every trip is costed at, by grade and destination class. */
export default function TravelPolicyPage() {
  return <PolicyTable />;
}
