import { Suspense } from "react";
import type { Metadata } from "next";
import OrgOverviewBoard from "@/suite/org/components/overview/OrgOverviewBoard";

export const metadata: Metadata = {
  title: "Organisation overview",
  robots: { index: false, follow: false },
};

/**
 * The organisation console's landing: end-to-end figures across every module
 * this organisation has switched on. It replaced a redirect to the user list
 * on the owner's instruction of 26 September 2026. The figures now come from
 * one API endpoint (`GET /api/admin/overview`), so nothing here is invented.
 * Suspense because the reporting window is read from the URL.
 */
export default function OrgOverviewPage() {
  return (
    <Suspense fallback={null}>
      <OrgOverviewBoard />
    </Suspense>
  );
}
