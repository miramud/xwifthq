import { Suspense } from "react";
import type { Metadata } from "next";
import SourcingDesk from "@/suite/operations/components/procurement/SourcingDesk";

export const metadata: Metadata = { title: "Requests & sourcing" };

/** The sourcing desk (`?tab=source|award|approval|all`). */
export default function SourcingDeskPage() {
  return (
    <Suspense>
      <SourcingDesk />
    </Suspense>
  );
}
