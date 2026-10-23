import { redirect } from "next/navigation";

/**
 * "new" is reserved as a project slug (`ProjectController::RESERVED_SLUGS`),
 * so without this page /suite/projects/new fell through to `[slug]` and said
 * the project did not exist. It means "start a project": the list opens the
 * form, and only for somebody allowed to start one.
 */
export default function NewProjectPage() {
  redirect("/suite/projects?new=1");
}
