import type { Metadata } from "next";
import RequestDetail from "@/suite/finance/components/requests/RequestDetail";

export const metadata: Metadata = { title: "Request" };

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetail id={id} />;
}
