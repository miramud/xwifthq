import { authenticatedProxy } from "@/lib/api/proxy";

/**
 * Authenticated proxy for /api/me/mfa/* - the signed-in person's own
 * authenticator app (two-step verification for large approvals and payment
 * schedules). Laravel scopes everything to the caller; no ids travel.
 */
const proxy = authenticatedProxy("me/mfa");

export const GET = proxy.GET;
export const POST = proxy.POST;
