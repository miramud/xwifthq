import type { Metadata } from "next";
import MyLeave from "@/suite/hrm/components/console/MyLeave";

export const metadata: Metadata = {
  title: "My leave",
  robots: { index: false, follow: false },
};

/*
  No `ManagerOnly`. Everybody with an employment record takes leave, and
  requiring an HR role would mean the HR manager books holiday on behalf of
  the whole institution.
*/
export default function MyLeavePage() {
  return <MyLeave />;
}
