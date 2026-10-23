import type { Metadata } from "next";
import MyEmployment from "@/suite/hrm/components/console/MyEmployment";

export const metadata: Metadata = {
  title: "My employment",
  robots: { index: false, follow: false },
};

/**
 * Deliberately not wrapped in `ManagerOnly`.
 *
 * This is the one HR page that is not for HR: it is a person's own record, and
 * the starter returning their forms is exactly who needs it. The API scopes it
 * to the caller's own employment, so there is no id here to tamper with.
 */
export default function MyEmploymentPage() {
  return <MyEmployment />;
}
