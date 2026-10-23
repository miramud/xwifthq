import { lmsFetch } from "@/lib/api/server";

/**
 * Authenticated proxy for /api/me/notification-channels — where the signed-in
 * person wants to be reached (Slack, WhatsApp). Role-agnostic: Laravel scopes
 * every read and write to the caller.
 *
 * Optional catch-all so both the bare path and `/test` land here.
 */
async function forward(req: Request, path: string[] = []): Promise<Response> {
  const url = new URL(req.url);
  const suffix = path.length > 0 ? `/${path.join("/")}` : "";
  const target = `/me/notification-channels${suffix}${url.search}`;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody ? await req.text() : undefined;

  const result = await lmsFetch(target, { method, auth: true, body: body || undefined });

  if (result.status === 204) return new Response(null, { status: 204 });

  return Response.json(result.body ?? {}, { status: result.status });
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function POST(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function PUT(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
