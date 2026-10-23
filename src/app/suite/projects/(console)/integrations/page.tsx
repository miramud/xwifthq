import type { Metadata } from "next";
import IntegrationsBoard from "@/suite/org/components/IntegrationsBoard";

export const metadata: Metadata = {
  title: "Integrations",
  robots: { index: false, follow: false },
};

/**
 * Slack and WhatsApp for project updates, from inside Projects.
 *
 * The same board as the org console's. It lives here too because the API lets
 * delivery leads manage it (`Capabilities::projectsLead`) and the org console
 * admits admins only. Anybody else gets the API's 403, which the board words.
 */
export default function ProjectsIntegrationsPage() {
  return <IntegrationsBoard />;
}
