import type { Metadata } from "next";
import ApprovalsInbox from "@/suite/approvals/components/ApprovalsInbox";

export const metadata: Metadata = { title: "Approvals" };

/** `?open={id}` opens a request (what every notification links to); `?tab=` picks the tab. */
export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ open?: string | string[]; tab?: string | string[] }>;
}) {
  const sp = await searchParams;
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  return <ApprovalsInbox initialOpen={first(sp.open)} initialTab={first(sp.tab)} />;
}
