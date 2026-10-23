import type { Metadata } from "next";
import IntegrationsBoard from "@/suite/org/components/IntegrationsBoard";

export const metadata: Metadata = {
  title: "Integrations",
  description: "This organisation's own Slack app, WhatsApp Business number and sending mailbox.",
  robots: { index: false, follow: false },
};

/**
 * Slack, WhatsApp and a Gmail or Zoho mailbox, on the organisation's own accounts.
 *
 * The org console layout already admits only admins; the API makes the final
 * call (and answers 403 to anybody else, which the board turns into words).
 */
export default function IntegrationsPage() {
  return <IntegrationsBoard />;
}
