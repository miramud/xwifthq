import type { Metadata } from "next";
import MyWork from "@/suite/hrm/components/console/MyWork";

export const metadata: Metadata = {
  title: "My work",
  robots: { index: false, follow: false },
};

/**
 * What is on somebody's plate, and where they stand against their targets.
 *
 * Their own, so no manager gate, and they see the same figures their manager
 * does. A performance system whose numbers are only visible at the review is
 * one that produces surprises rather than improvement.
 */
export default function MyWorkPage() {
  return <MyWork />;
}
