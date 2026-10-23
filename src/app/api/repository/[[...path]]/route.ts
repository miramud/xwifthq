import { authenticatedProxy } from "@/lib/api/proxy";

/** Authenticated proxy for /api/repository/* - staff search, downloads and policies to read. */
const proxy = authenticatedProxy("repository");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
