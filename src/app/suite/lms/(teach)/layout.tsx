import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/api/server";
import { teaches } from "@/lib/roles";
import { requireActiveModule } from "@/lib/module-guard";
import InstructorShell from "@/suite/lms/components/instructor/InstructorShell";

export const metadata: Metadata = {
  title: "Instructor Studio",
  robots: { index: false, follow: false },
};

/**
 * The instructor studio, at /suite/lms/teach.
 *
 * Its own route group because it answers to a different role than the LMS
 * console beside it and wears InstructorShell rather than AdminShell.
 * Grouping keeps both under /suite/lms — where all LMS surface now lives —
 * without nesting one console's chrome inside the other's.
 */
export default async function InstructorStudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite/lms/teach");
  // Admins can view the studio too; everyone else is bounced.
  requireActiveModule(user, "lms");

  // Teaching comes from a teaching role (or running the LMS), not the session's
  // `role`. Anybody else is a learner here, so they go to their learning space.
  if (!teaches(user)) redirect("/my-courses");

  return <InstructorShell>{children}</InstructorShell>;
}
