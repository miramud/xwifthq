import { Suspense } from "react";
import type { Metadata } from "next";
import CompanyReport from "@/suite/finance/components/reports/company/CompanyReport";

export const metadata: Metadata = { title: "Company report" };

export default function CompanyReportPage() {
  return (
    <Suspense>
      <CompanyReport />
    </Suspense>
  );
}
