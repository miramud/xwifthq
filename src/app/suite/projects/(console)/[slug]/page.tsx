import type { Metadata } from "next";
import ProjectWorkspace from "@/suite/projects/components/ProjectWorkspace";

export const metadata: Metadata = {
  title: "Project",
  robots: { index: false, follow: false },
};

/**
 * One project: board, backlog and team.
 *
 * The slug is the route key, so a board can be linked to and a reference
 * quoted in a client email. It is unique per tenant rather than globally —
 * two institutions may both run a "Website Rebuild".
 */
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <ProjectWorkspace slug={slug} />;
}
