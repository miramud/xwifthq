import { Suspense } from "react";
import type { Metadata } from "next";
import RequestEditor from "@/suite/finance/components/requests/RequestEditor";

export const metadata: Metadata = { title: "New request" };

/** A new request, or a draft being finished (`?id=`). */
export default function NewRequestPage() {
  return (
    <Suspense>
      <RequestEditor />
    </Suspense>
  );
}
