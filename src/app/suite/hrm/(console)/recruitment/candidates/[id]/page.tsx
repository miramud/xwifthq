import type { Metadata } from "next";
import CandidateDetail from "@/suite/hrm/components/console/CandidateDetail";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";

export const metadata: Metadata = {
  title: "Candidate",
  robots: { index: false, follow: false },
};

export default async function HrmCandidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ManagerOnly>
      <CandidateDetail candidateId={id} />
    </ManagerOnly>
  );
}
