import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/api/server";

export const metadata: Metadata = {
  title: "Suite",
  // Signed-in surface. Nothing under /suite should ever appear in a search
  // result, least of all a preview dashboard full of invented figures.
  robots: { index: false, follow: false },
};

/**
 * The one gate every suite surface shares: you must be signed in.
 *
 * This layout deliberately renders **no shell**. Three different shells live
 * below it, SuiteShell for the launcher and the four preview modules,
 * AdminShell for the LMS and organisation consoles, InstructorShell for the
 * studio, and a shell here would wrap every one of them in a second chrome.
 * Each route group supplies its own, together with the role check that goes
 * with it.
 *
 * There is deliberately no role check here either, and that is the point of
 * putting the gate at this level: the launcher is not administrative surface.
 * An instructor or a learner signing in has every right to see which modules
 * exist and what they do. What any of them can actually *read* is decided by
 * tenant isolation and permissions in the API, and the four preview modules
 * read nothing at all, because there is no API behind them yet.
 */
export default async function SuiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Definitive, server-side gate (the proxy only checks cookie presence).
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite");

  return <>{children}</>;
}
