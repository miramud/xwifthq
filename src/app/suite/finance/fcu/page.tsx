import { Suspense } from "react";
import type { Metadata } from "next";
import FcuBoard from "@/suite/finance/components/fcu/FcuBoard";

export const metadata: Metadata = { title: "FCU" };

/** The FCU's four queues; the tab is in the address (`?tab=`). */
export default function FcuPage() {
  return (
    <Suspense>
      <FcuBoard />
    </Suspense>
  );
}
