import type { Metadata } from "next";
import PolicyBuilder from "@/suite/org/components/approvals/PolicyBuilder";

export const metadata: Metadata = { title: "Approval rules" };

export default async function PolicyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PolicyBuilder id={id} />;
}
