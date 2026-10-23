import type { Metadata } from "next";
import ProjectsBoard from "@/suite/projects/components/ProjectsBoard";

export const metadata: Metadata = {
  title: "Projects",
  robots: { index: false, follow: false },
};

/**
 * The module's front door: every project this person is staffed on.
 *
 * Its figures are the ones the project records themselves can answer —
 * lifecycle, target dates, clients — and nothing that needs sprint history.
 * Velocity, cost and forecast need history a new installation does not have,
 * and a wall of `—` teaches people to ignore the page; those live on each
 * project.
 */
export default function ProjectsIndexPage() {
  return <ProjectsBoard />;
}
