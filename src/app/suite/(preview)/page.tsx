import type { Metadata } from "next";
import { SuiteLauncher } from "@/components/suite/SuiteLauncher";
import { getServerUser } from "@/lib/api/server";

export const metadata: Metadata = {
  title: "Suite",
  robots: { index: false, follow: false },
};

export default async function SuitePage() {
  /*
    The layout has already resolved the user to run the gate, and this is the
    same GET to the same URL with the same options — which Next memoizes for
    the duration of a render pass, so the greeting costs no second round trip.
    (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md`,
    "Memoization".)
  */
  const user = await getServerUser();
  const firstName = user?.name.split(" ")[0] ?? null;

  return <SuiteLauncher firstName={firstName} />;
}
