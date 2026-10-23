import type { Metadata } from "next";
import CorrespondenceDetail from "@/suite/operations/components/correspondence/CorrespondenceDetail";

export const metadata: Metadata = { title: "Letter" };

/** One letter: its papers, its minute sheet, routing or dispatch. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CorrespondenceDetail id={id} />;
}
