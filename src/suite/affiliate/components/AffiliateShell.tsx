"use client";

import { Building2, HandCoins, Landmark, LayoutDashboard, Wallet } from "lucide-react";
import WorkspaceShell, { type WsNavGroup, type WsTitle } from "@/components/workspace/WorkspaceShell";

/**
 * The affiliate's own workspace: their link and what it has earned, the
 * organisations it brought in, the commission on each and the payouts that
 * settled it. Everyone who reaches it sees every page; the layout has
 * already checked they are an affiliate, and the API scopes every answer to
 * the caller.
 */
const NAV: WsNavGroup[] = [
  {
    heading: "General",
    items: [{ label: "Overview", href: "/suite/affiliate", icon: LayoutDashboard, exact: true }],
  },
  {
    heading: "Earnings",
    items: [
      { label: "Referrals", href: "/suite/affiliate/referrals", icon: Building2 },
      { label: "Commissions", href: "/suite/affiliate/commissions", icon: HandCoins },
      { label: "Payouts", href: "/suite/affiliate/payouts", icon: Wallet },
    ],
  },
  {
    heading: "Account",
    items: [{ label: "Payout details", href: "/suite/affiliate/settings", icon: Landmark }],
  },
];

/** Every page has a nav item; these keep the title right for anything beneath one. */
const TITLES: WsTitle[] = [
  { match: "/suite/affiliate/referrals/", title: "Referrals" },
  { match: "/suite/affiliate/commissions/", title: "Commissions" },
  { match: "/suite/affiliate/payouts/", title: "Payouts" },
  { match: "/suite/affiliate/settings/", title: "Payout details" },
];

export default function AffiliateShell({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceShell module="affiliate" nav={NAV} titles={TITLES}>
      {children}
    </WorkspaceShell>
  );
}
