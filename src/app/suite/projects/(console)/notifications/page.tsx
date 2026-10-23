import type { Metadata } from "next";
import { MyNotificationsPage } from "@/suite/hrm/components/ui2/me-notifications";

export const metadata: Metadata = {
  title: "My notifications",
  robots: { index: false, follow: false },
};

/**
 * The same switches and channels as HRM's page, reachable from Projects.
 *
 * A project member with no HR role had no way to turn project
 * notifications off, or to have them reach Slack or WhatsApp.
 */
export default function ProjectsNotificationsPage() {
  return (
    <MyNotificationsPage
      eyebrow="Projects"
      title="My notifications"
      subtitle="What reaches you about your work, and where — in Elevate, Slack or WhatsApp."
    />
  );
}
