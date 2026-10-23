import { lmsFetch } from "@/lib/api/server";

/**
 * Authenticated proxy for the requester side of support tickets.
 *
 * Mirrors the /api/admin and /api/instructor catch-alls: method, path, query
 * and body are forwarded to Laravel's /support/* routes with the httpOnly
 * bearer token attached server-side. Every one of those routes is scoped to the
 * caller's own tickets, so no additional filtering belongs here.
 */
async function forward(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const target = `/support/${path.join("/")}${url.search}`;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody ? await req.text() : undefined;

  const result = await lmsFetch(target, { method, auth: true, body });

  // A 204 must not carry a body: `Response.json({}, { status: 204 })` throws,
  // which turns every successful empty response into a 500 for the browser.
  if (result.status === 204) return new Response(null, { status: 204 });

  return Response.json(result.body ?? {}, { status: result.status });
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path ?? []);
}
export async function POST(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path ?? []);
}
export async function PATCH(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path ?? []);
}
