import { redirect } from "next/navigation";

/** Renamed to User management; HRM owns "People". Old links still land. */
export default function OldPeoplePage() {
  redirect("/suite/org/users");
}
