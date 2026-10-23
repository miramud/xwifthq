import { Suspense } from "react";
import type { Metadata } from "next";
import ProjectFundsDetail from "@/suite/finance/components/projects/ProjectFundsDetail";

export const metadata: Metadata = { title: "Project funds" };

/** Budget and fund-release approvals link here. */
export default async function FinanceProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense>
      <ProjectFundsDetail id={id} />
    </Suspense>
  );
}
