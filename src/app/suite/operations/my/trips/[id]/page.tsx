import type { Metadata } from "next";
import MyTripDetail from "@/suite/operations/components/my-trips/MyTripDetail";

export const metadata: Metadata = { title: "Trip" };

export default async function MyTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MyTripDetail id={id} />;
}
