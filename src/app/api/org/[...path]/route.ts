import { authenticatedProxy } from "@/lib/api/proxy";

/**
 * Authenticated proxy for /api/org/* — the organisation's own settings that
 * are not the platform owner's (its Slack app and WhatsApp number, its job
 * titles, the DoA matrix PDF) and the document repository, whose uploads are
 * multipart and whose downloads are files: `authenticatedProxy` passes both
 * through as bytes. Who may use them is decided by Laravel; this only
 * attaches the token.
 */
const proxy = authenticatedProxy("org");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
