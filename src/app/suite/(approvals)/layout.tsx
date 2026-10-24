import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ApprovalsShell from "@/components/suite/ApprovalsShell";
import { getServerUser } from "@/lib/api/server";

export const metadata: Metadata = {
  title: "Approvals",
  robots: { index: false, follow: false },
};

/**
 * The approvals inbox, memos and cover: shared by every module, so a route
 * group of their own rather than a corner of HR or Projects. URLs stay
 * /suite/approvals and /suite/memos.
 *
 * Signed in is all this checks. Belonging to an organisation is checked by
 * the shell (`requiresOrganisation`), which explains itself instead of
 * redirecting; what anybody can see is decided by the API: a request is
 * visible only to the people on it.
 */
export default async function ApprovalsLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite/approvals");

  return <ApprovalsShell>{children}</ApprovalsShell>;
}
