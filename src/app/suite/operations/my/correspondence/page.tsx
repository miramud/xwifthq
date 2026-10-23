import type { Metadata } from "next";
import MyCorrespondence from "@/suite/operations/components/my-correspondence/MyCorrespondence";

export const metadata: Metadata = { title: "Letters for my action" };

/** Letters the registry has routed to me. */
export default function Page() {
  return <MyCorrespondence />;
}
