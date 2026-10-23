import type { Metadata } from "next";
import MyHelpDetail from "@/suite/operations/components/my-help/MyHelpDetail";

export const metadata: Metadata = { title: "My request" };

/** One of my requests: the conversation, and rating it when it is done. */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MyHelpDetail id={id} />;
}
