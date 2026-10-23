import type { Metadata } from "next";
import FacilityDetail from "@/suite/operations/components/facilities/FacilityDetail";

export const metadata: Metadata = { title: "Facility" };

/** A site: rooms, lease and rent, utilities, contracts and the diesel log. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FacilityDetail id={id} />;
}
