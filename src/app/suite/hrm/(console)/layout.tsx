import type { Metadata } from "next";
import { redirect } from "next/navigation";
import HrmShell from "@/suite/hrm/components/console/HrmShell";
import { getServerUser } from "@/lib/api/server";
import { requireActiveModule } from "@/lib/module-guard";

export const metadata: Metadata = {
  title: "HR Console",
  robots: { index: false, follow: false },
};

/**
 * XwiftHQ HRM: the employment record, onboarding, contracts, probation and
 * internships.
 *
 * A route group, so `/suite/hrm` keeps its URL while carrying `HrmShell`
 * rather than the `SuiteShell` the four unbuilt modules wear. It sits outside
 * `(preview)` for the same reason `/suite/lms` does — this one reads a real
 * API, and a preview banner over real figures would be a lie in the other
 * direction.
 *
 * **There is no role check here, deliberately.** Every route under it is
 * not for HR: `/suite/hrm/me` is a person's own employment record, and
 * requiring a role to see your own contract would mean granting
 * everybody one to no purpose. The management pages gate themselves, and the
 * API gates all of it regardless — `access:hrm` answers 403 naming the
 * permission keys that are missing, which is a better failure than a redirect
 * to somewhere the reader did not ask for.
 */
export default async function HrmConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Definitive, server-side gate (the proxy only checks cookie presence).
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite/hrm");
  requireActiveModule(user, "hrm");

  return <HrmShell>{children}</HrmShell>;
}
