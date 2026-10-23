import { lmsFetch } from "@/lib/api/server";

/**
 * Public proxy for `/api/public/*`: the price list and sales requests.
 *
 * No session token is attached — these are for visitors, and a signed-in
 * visitor asking for prices must get exactly what everybody else gets. Status
 * and body pass straight through.
 */
async function forward(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const method = req.method.toUpperCase();
  const body = method === "GET" || method === "HEAD" ? undefined : await req.text();

  const result = await lmsFetch(`/public/${path.join("/")}${url.search}`, { method, body });

  // An empty 204 must not be given a body; `Response.json` would throw.
  if (result.status === 204) return new Response(null, { status: 204 });

  return Response.json(result.body ?? {}, { status: result.status });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function POST(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
