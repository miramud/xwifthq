import type { Metadata } from "next";
import CorrespondenceRegister from "@/suite/operations/components/correspondence/CorrespondenceRegister";

export const metadata: Metadata = { title: "Correspondence" };

/** The correspondence register: letters received and sent. */
export default function Page() {
  return <CorrespondenceRegister />;
}
