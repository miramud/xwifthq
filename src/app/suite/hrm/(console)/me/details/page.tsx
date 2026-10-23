import type { Metadata } from "next";
import MyDetails from "@/suite/hrm/components/console/MyDetails";

export const metadata: Metadata = {
  title: "My details",
  robots: { index: false, follow: false },
};

/**
 * Deliberately not wrapped in `ManagerOnly`, for the same reason as
 * `/me` itself: this is a person's own record. The API scopes it to the
 * caller's own employment, so there is no id here to tamper with, and the
 * fields it will accept are bounded by `Employee::SELF_EDITABLE` rather than
 * by what this page happens to render.
 */
export default function MyDetailsPage() {
  return <MyDetails />;
}
