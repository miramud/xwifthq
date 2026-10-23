import type { Metadata } from "next";
import { redirect } from "next/navigation";
import OperationsShell from "@/suite/operations/components/OperationsShell";
import { getServerUser } from "@/lib/api/server";
import { requireActiveModule } from "@/lib/module-guard";

export const metadata: Metadata = {
  title: { template: "%s · Operations", default: "Operations" },
  robots: { index: false, follow: false },
};

/**
 * XwiftHQ Admin & Operations: procurement, travel, events and client
 * payments. An organisation without the module (or while it is unreleased)
 * lands on its preview; the API refuses the same routes regardless.
 */
export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite/operations");
  requireActiveModule(user, "admin");

  return <OperationsShell>{children}</OperationsShell>;
}
