import { authenticatedProxy } from "@/lib/api/proxy";

/** Authenticated proxy for /api/approvals/* - the inbox every module shares. */
const proxy = authenticatedProxy("approvals");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
