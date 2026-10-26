import type { Metadata } from "next";
import { redirect } from "next/navigation";
import AffiliateShell from "@/suite/affiliate/components/AffiliateShell";
import NotAnAffiliate from "@/suite/affiliate/components/NotAnAffiliate";
import { getServerUser } from "@/lib/api/server";
import { landingFor } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Affiliate",
  robots: { index: false, follow: false },
};

/**
 * The affiliate's dashboard, for approved affiliates and suspended ones (who
 * keep their history). Everyone else is told why, and where to apply.
 */
export default async function AffiliateLayout({ children }: { children: React.ReactNode }) {
  // Definitive, server-side gate (the proxy only checks cookie presence).
  const user = await getServerUser();
  if (!user) redirect("/login?redirect=/suite/affiliate");

  if (!user.affiliate) {
    return <NotAnAffiliate home={landingFor(user)} />;
  }

  return <AffiliateShell>{children}</AffiliateShell>;
}
