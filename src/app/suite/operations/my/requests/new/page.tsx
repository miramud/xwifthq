import { Suspense } from "react";
import type { Metadata } from "next";
import PurchaseRequestEditor from "@/suite/operations/components/my-requests/PurchaseRequestEditor";

export const metadata: Metadata = { title: "New purchase request" };

/** A new purchase request, or a draft being finished (`?id=`). */
export default function NewPurchaseRequestPage() {
  return (
    <Suspense>
      <PurchaseRequestEditor />
    </Suspense>
  );
}
