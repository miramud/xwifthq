import type { Metadata } from "next";
import DeskTripDetail from "@/suite/operations/components/travel/DeskTripDetail";

export const metadata: Metadata = { title: "Trip" };

export default async function DeskTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DeskTripDetail id={id} />;
}
