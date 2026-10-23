import { authenticatedProxy } from "@/lib/api/proxy";

/** Authenticated proxy for /api/operations/* - procurement, travel, events, client payments. */
const proxy = authenticatedProxy("operations");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
