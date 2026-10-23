import type { Metadata } from "next";
import MyCorrespondenceDetail from "@/suite/operations/components/my-correspondence/MyCorrespondenceDetail";

export const metadata: Metadata = { title: "Letter for my action" };

/** A letter routed to me: acknowledge, minute, forward, reply, respond. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MyCorrespondenceDetail id={id} />;
}
