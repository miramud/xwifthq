import { lmsFetch } from "@/lib/api/server";

/**
 * Authenticated proxy for learning paths and their assignments.
 *
 * Covers the routes both admins and instructors share — reading paths and
 * assigning them. Authoring (POST/PATCH/DELETE on the path itself) lives under
 * `/api/admin/learning-paths`, which the admin catch-all already carries,
 * because Laravel gates it on `role:admin`.
 */
async function forward(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const target = `/learning-paths${path.length > 0 ? `/${path.join("/")}` : ""}${url.search}`;

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
export async function DELETE(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path ?? []);
}
