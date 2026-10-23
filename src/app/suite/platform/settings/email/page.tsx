import type { Metadata } from "next";
import MailSettingsBoard from "@/suite/org/components/MailSettingsBoard";

export const metadata: Metadata = {
  title: "Email delivery",
  description: "The service that sends the platform's own email.",
  robots: { index: false, follow: false },
};

/**
 * The platform's own email provider: onboarding welcomes, sales and owner
 * notices, and mail for people outside any organisation. The same board as an
 * organisation's Email delivery page, at the platform scope. The Platform
 * console layout admits only platform people; the API answers 403 to anyone
 * without `platform.settings.manage`, which the board turns into words.
 */
export default function PlatformEmailDeliveryPage() {
  return <MailSettingsBoard scope="platform" />;
}
