import { lmsFetch } from "@/lib/api/server";

/**
 * Authenticated proxy for /api/notifications/*, shared by learners, instructors
 * and admins — the Laravel routes are role-agnostic and scope every query to the
 * signed-in user.
 *
 * Optional catch-all so `/api/notifications` (no segments) and
 * `/api/notifications/<id>/read` both land here.
 */
async function forward(req: Request, path: string[] = []): Promise<Response> {
  const url = new URL(req.url);
  const suffix = path.length > 0 ? `/${path.join("/")}` : "";
  const target = `/notifications${suffix}${url.search}`;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody ? await req.text() : undefined;

  const result = await lmsFetch(target, { method, auth: true, body: body || undefined });

  // 204 must not carry a body.
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
// `/notifications/preferences` is a PUT.
export async function PUT(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function DELETE(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
