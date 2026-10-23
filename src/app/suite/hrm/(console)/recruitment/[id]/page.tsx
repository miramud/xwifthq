import type { Metadata } from "next";
import ManagerOnly from "@/suite/hrm/components/console/ManagerOnly";
import RequisitionDetail from "@/suite/hrm/components/console/RequisitionDetail";

export const metadata: Metadata = {
  title: "Role",
  robots: { index: false, follow: false },
};

export default async function HrmRequisitionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <ManagerOnly>
      <RequisitionDetail requisitionId={id} />
    </ManagerOnly>
  );
}
