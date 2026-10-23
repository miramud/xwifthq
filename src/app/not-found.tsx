import type { Metadata } from "next";
import NotFoundState from "@/components/feedback/NotFoundState";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * A 404 is not a failure, so it does not wear the error styling: nothing
 * broke, the address simply does not lead anywhere. Where it points depends on
 * where the reader was (`recoveryFor`): a missing project leads back to the
 * projects, a mistyped course URL to the catalog.
 */
export default function NotFound() {
  return <NotFoundState />;
}
