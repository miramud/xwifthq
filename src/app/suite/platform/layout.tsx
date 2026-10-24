import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PlatformShell from "@/suite/platform/components/PlatformShell";
import { getServerUser } from "@/lib/api/server";
import ConsoleRefused from "@/components/shared/ConsoleRefused";
import { landingFor } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Platform console",
  robots: { index: false, follow: false },
};

/**
 * The platform console, for the people who run the platform itself.
 *
 * The super admin, and platform staff (no organisation) holding platform
 * roles. Which pages each of them sees inside is decided per permission by
 * the shell and, definitively, by the API.
 */
export default async function PlatformConsoleLayout({ children }: { children: React.ReactNode }) {
  // Definitive, server-side gate (the proxy only checks cookie presence).
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite/platform");

  const role = user.role as string;
  if (role !== "super_admin" && role !== "platform_staff") {
    // Explain rather than bounce; see ConsoleRefused.
    return <ConsoleRefused console="Platform console" who="the people who run the platform" home={landingFor(user)} />;
  }

  return <PlatformShell>{children}</PlatformShell>;
}
