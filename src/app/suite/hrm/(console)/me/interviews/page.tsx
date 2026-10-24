import type { Metadata } from "next";
import MyInterviews from "@/suite/hrm/components/console/MyInterviews";

export const metadata: Metadata = {
  title: "My interviews",
  robots: { index: false, follow: false },
};

/*
  No `ManagerOnly`. Anybody can be put on a panel, that is the point of a
  panel, and requiring an HR role to record what you thought would mean
  only recruiters could ever be asked to interview.
*/
export default function MyInterviewsPage() {
  return <MyInterviews />;
}
