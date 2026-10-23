import "server-only";
import { redirect } from "next/navigation";
import { moduleStatus, previewHref, type SuiteModuleKey } from "@/lib/module-access";
import { getServerUser, type ServerUser } from "@/lib/api/server";

/**
 * The route-level half of module activation, for server layouts.
 *
 * A module the organisation has not switched on is a preview: every page in it
 * sends the reader to that module's preview page instead of rendering a
 * console whose every request would come back 403. The API refuses the same
 * routes regardless — this only decides where a person lands.
 */
export function requireActiveModule(user: ServerUser, key: SuiteModuleKey): void {
  if (moduleStatus(user, key) === "preview") redirect(previewHref(key));
}

/**
 * The learner space (my courses, the player, certificates, paths,
 * achievements) belongs to the LMS too. Signed-out visitors are left to the
 * page's own sign-in handling; a member of an organisation without the LMS
 * lands on its preview.
 */
export async function guardLearnerSpace(): Promise<void> {
  const user = await getServerUser();
  if (user) requireActiveModule(user, "lms");
}
