import type { Metadata } from "next";
import ExitClearances from "@/suite/operations/components/assets/ExitClearances";

export const metadata: Metadata = { title: "Exit clearances" };

/** Leavers' assets and the four sign-offs. */
export default function ExitClearancesPage() {
  return <ExitClearances />;
}
