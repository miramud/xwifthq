import type { Metadata } from "next";
import VerificationDesk from "@/suite/operations/components/assets/VerificationDesk";

export const metadata: Metadata = { title: "Asset verification" };

/** Verification campaigns: the register against what is found. */
export default function VerificationDeskPage() {
  return <VerificationDesk />;
}
