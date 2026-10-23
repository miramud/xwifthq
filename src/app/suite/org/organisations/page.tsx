import { redirect } from "next/navigation";

/** Moved to the platform console. Old bookmarks land in the right place. */
export default function MovedOrganisationsPage() {
  redirect("/suite/platform/organisations");
}
