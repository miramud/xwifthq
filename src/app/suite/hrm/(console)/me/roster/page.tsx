import type { Metadata } from "next";
import MyRoster from "@/suite/hrm/components/console/MyRoster";

export const metadata: Metadata = {
  title: "My rota",
  robots: { index: false, follow: false },
};

/*
  No `ManagerOnly`. Everybody on a roster reads their own, and swapping a shift
  is a conversation between colleagues that a manager signs off rather than
  starts.
*/
export default function MyRosterPage() {
  return <MyRoster />;
}
