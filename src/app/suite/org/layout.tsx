import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminShell from "@/components/console/AdminShell";
import { getServerUser } from "@/lib/api/server";
import ConsoleRefused from "@/components/shared/ConsoleRefused";
import { landingFor } from "@/lib/roles";
import { admitsToOrgConsole } from "@/lib/org-access";

export const metadata: Metadata = {
  title: "Organisation Console",
  robots: { index: false, follow: false },
};

/**
 * The organisation console — the spine's own administration.
 *
 * People, organisations, policies, branding, settings, seats, the audit log,
 * the support queue, revenue and the platform owner's cross-tenant views.
 *
 * These screens are **Core**, not the Admin module: in the API they are
 * App\Suite\Core controllers over User, Organisation, PlatformSetting,
 * SeatPurchase, AuditLog, SupportTicket and Order. They live at /suite/org
 * rather than /suite/admin for two reasons — the unbuilt *Elevate Admin*
 * product (organisation tree, assets, requisitions, approvals) keeps its own
 * front door, and no screen showing real tenant data ends up sitting beneath a
 * preview dashboard of invented figures.
 */
export default async function OrgConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Definitive, server-side role gate (the proxy only checks cookie presence).
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite/org");

  // Both administrative roles belong here: `admin` runs one institution,
  // `super_admin` runs the platform. So does anybody whose custom role holds
  // a key for one of its pages (S8: the Auditor, Billing manager, Support
  // desk) - the shell then shows them only those pages. What each of them can
  // actually see is decided by the API, not by this gate.
  if (!admitsToOrgConsole(user)) {
    // Explain rather than bounce: the old redirect to `/?error=admin-only`
    // dropped a member on the marketing home page with no reason given.
    return <ConsoleRefused console="Organisation console" who="your organisation's admins" home={landingFor(user)} />;
  }

  return <AdminShell>{children}</AdminShell>;
}
