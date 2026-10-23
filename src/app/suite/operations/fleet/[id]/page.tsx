import type { Metadata } from "next";
import VehicleDetail from "@/suite/operations/components/fleet/VehicleDetail";

export const metadata: Metadata = { title: "Vehicle" };

export default async function VehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VehicleDetail id={id} />;
}
