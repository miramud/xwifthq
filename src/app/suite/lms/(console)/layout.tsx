import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AdminShell from "@/components/console/AdminShell";
import { getServerUser } from "@/lib/api/server";
import { administersLms } from "@/lib/roles";
import { requireActiveModule } from "@/lib/module-guard";

export const metadata: Metadata = {
  title: "LMS Console",
  robots: { index: false, follow: false },
};

/**
 * The LMS console: catalogue, learners, instructors, certificates, paths.
 *
 * A route group so the studio at /suite/lms/teach can carry InstructorShell
 * instead of this one without either URL changing. Both groups are LMS and
 * both live under /suite/lms: they simply answer to different roles and wear
 * different chrome.
 */
export default async function LmsConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Definitive, server-side role gate (the proxy only checks cookie presence).
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite/lms");

  // Both administrative roles belong here: `admin` runs one institution,
  // `super_admin` runs the platform. What each of them can actually see is
  // decided by tenant isolation in the API, not by this gate.
  // The HR Manager runs learning too: the user's rule, enforced on the API
  // by the same capability. Presentation-side here, to route them in rather
  // than bounce them to the home page.
  requireActiveModule(user, "lms");

  // A plain user has no console to see; their part of the LMS is the
  // learning space, so that is where they land rather than the home page.
  if (!administersLms(user)) redirect("/my-courses");

  return <AdminShell>{children}</AdminShell>;
}
