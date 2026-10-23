import type { Metadata } from "next";
import ControlledDetail from "@/suite/operations/components/documents/ControlledDetail";

export const metadata: Metadata = { title: "Controlled document" };

export default async function ControlledDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ControlledDetail id={id} />;
}
