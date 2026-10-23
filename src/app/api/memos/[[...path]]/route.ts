import { authenticatedProxy } from "@/lib/api/proxy";

/** Authenticated proxy for /api/memos/* - memos and their PDFs. */
const proxy = authenticatedProxy("memos");

export const GET = proxy.GET;
export const POST = proxy.POST;
export const PUT = proxy.PUT;
export const PATCH = proxy.PATCH;
export const DELETE = proxy.DELETE;
