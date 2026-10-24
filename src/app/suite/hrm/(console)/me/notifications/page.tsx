import type { Metadata } from "next";
import { MyNotificationsPage } from "@/suite/hrm/components/ui2/me-notifications";

export const metadata: Metadata = {
  title: "My notifications",
  robots: { index: false, follow: false },
};

/*
  The switches themselves were built with the HRM notifications and honoured on
  send from day one. What was missing was a way in: the only page rendering the
  registry sat inside the LMS teach console, so an HR manager, who is very
  often not an instructor, had three preferences they could not reach. A
  preference nobody can find is the same as no preference.

  No `ManagerOnly`. Everybody with an employment record is sent something.
*/
export default function HrmNotificationsPage() {
  return (
    <MyNotificationsPage
      title="My notifications"
      subtitle="Every switch here turns a real message on or off. What you see depends on what you do here."
    />
  );
}
