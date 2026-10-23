import type { Metadata } from "next";
import PortfolioManager from "@/suite/projects/components/PortfolioManager";

export const metadata: Metadata = {
  title: "Portfolios",
  robots: { index: false, follow: false },
};

/**
 * The shelves projects sit on.
 *
 * The nav promised this route before anything served it. The endpoints had
 * existed since the first commit and nothing called them, so folders could be
 * read and never created — which left the "Folder" field on a new project
 * permanently empty.
 */
export default function PortfoliosPage() {
  return <PortfolioManager />;
}
