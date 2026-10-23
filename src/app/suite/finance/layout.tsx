import type { Metadata } from "next";
import { redirect } from "next/navigation";
import FinanceShell from "@/suite/finance/components/FinanceShell";
import { getServerUser } from "@/lib/api/server";
import { requireActiveModule } from "@/lib/module-guard";

export const metadata: Metadata = {
  title: { template: "%s · Finance", default: "Finance" },
  robots: { index: false, follow: false },
};

/**
 * XwiftHQ Finance: the ledger, banking and the financial statements. An
 * organisation without Finance (or while Finance is unreleased) lands on its
 * preview; the API refuses the same routes regardless.
 */
export default async function FinanceLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite/finance");
  requireActiveModule(user, "finance");

  return <FinanceShell>{children}</FinanceShell>;
}
