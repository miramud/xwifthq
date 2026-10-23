import { redirect } from "next/navigation";

/** Platform insights moved to the platform console as the revenue portfolio. */
export default function MovedPlatformInsightsPage() {
  redirect("/suite/platform/portfolio");
}
