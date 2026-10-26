import { authenticatedProxy } from "@/lib/api/proxy";

/**
 * Authenticated proxy for /api/me/affiliate/* - the signed-in person's own
 * affiliate dashboard: figures, referrals, commissions, payouts and payout
 * details. Laravel scopes everything to the caller; no ids travel.
 */
const proxy = authenticatedProxy("me/affiliate");

export const GET = proxy.GET;
export const PUT = proxy.PUT;
