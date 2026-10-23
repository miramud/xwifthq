import { authenticatedProxy } from "@/lib/api/proxy";

/** Authenticated proxy for /api/finance/* - the ledger, banking and reports. */
const proxy = authenticatedProxy("finance");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
