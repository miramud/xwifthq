import { cookies } from "next/headers";
import { AUTH_COOKIE, lmsFetch } from "@/lib/api/server";

const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

/**
 * Authenticated proxy for the platform-owner console (`/api/platform/*`).
 *
 * Laravel gates every one of these on `role:super_admin`, so an institution
 * admin who guessed the URL gets a 403 from the API — this layer adds no
 * permission logic of its own, it only carries the httpOnly token across.
 */
async function forward(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const target = `/platform/${path.join("/")}${url.search}`;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody ? await req.text() : undefined;

  const result = await lmsFetch(target, { method, auth: true, body });

  // A 204 must not carry a body: `Response.json({}, { status: 204 })` throws,
  // which turns every successful empty response into a 500 for the browser.
  if (result.status === 204) return new Response(null, { status: 204 });

  return Response.json(result.body ?? {}, { status: result.status });
}

/**
 * A file download, passed through as bytes with its filename.
 *
 * `forward` reads the upstream body as text and wraps it in JSON, which turns
 * a CSV into a quoted string. Only the licence ledger's `?format=csv` comes
 * through here; its refusals (403, 422) are still JSON and keep their status.
 */
async function forwardDownload(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  const upstream = await fetch(`${API_URL}/platform/${path.join("/")}${url.search}`, {
    headers: {
      Accept: "application/json, text/csv",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  const headers = new Headers();
  for (const name of ["content-type", "content-disposition", "content-length"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}

type Ctx = { params: Promise<{ path?: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path ?? [];

  // The licence ledger's CSV is the one file here; everything else is JSON.
  if (path.join("/") === "sales/licences" && new URL(req.url).searchParams.get("format") === "csv") {
    return forwardDownload(req, path);
  }

  return forward(req, path);
}
export async function POST(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path ?? []);
}
export async function PATCH(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path ?? []);
}
// Replacing an organisation's module entitlements is a PUT.
export async function PUT(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path ?? []);
}
export async function DELETE(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path ?? []);
}
