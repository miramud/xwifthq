import type { Metadata } from "next";
import MailSettingsBoard from "@/suite/org/components/MailSettingsBoard";

export const metadata: Metadata = {
  title: "Email delivery",
  description: "The service that sends this organisation's email.",
  robots: { index: false, follow: false },
};

/**
 * The organisation's own email provider.
 *
 * The org console layout already admits only admins; the API makes the final
 * call (and answers 403 to anybody else, which the board turns into words).
 */
export default function EmailDeliveryPage() {
  return <MailSettingsBoard />;
}
