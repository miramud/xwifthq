import type { Metadata } from "next";
import { redirect } from "next/navigation";
import ProjectsShell from "@/suite/projects/components/ProjectsShell";
import { getServerUser } from "@/lib/api/server";
import { requireActiveModule } from "@/lib/module-guard";

export const metadata: Metadata = {
  title: "Delivery",
  robots: { index: false, follow: false },
};

/**
 * XwiftHQ Projects: portfolios, projects, sprints and the board.
 *
 * A route group, so `/suite/projects` keeps its URL while wearing
 * `ProjectsShell` rather than the preview chrome the unbuilt modules wear.
 * It sits outside `(preview)` for the same reason `/suite/hrm` does — this one
 * reads a real API, and a preview banner over real figures would be a lie in
 * the other direction.
 *
 * **No role check here, deliberately**, and for a different reason than
 * HRM's. Authority in this module is per project rather than organisation-wide:
 * an engineer may hold no Projects role at all and must still reach the board they
 * are staffed on. Every list arrives already narrowed to the viewer's
 * membership, and `ProjectPolicy` refuses anything else — with a 403 naming
 * what is missing, which is a better failure than a redirect somewhere the
 * reader did not ask for.
 */
export default async function ProjectsConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Definitive, server-side gate (the proxy only checks cookie presence).
  const user = await getServerUser();

  if (!user) redirect("/login?redirect=/suite/projects");
  requireActiveModule(user, "projects");

  return <ProjectsShell>{children}</ProjectsShell>;
}
