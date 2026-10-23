import { cookies } from "next/headers";
import { AUTH_COOKIE, lmsFetch } from "@/lib/api/server";

const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

/**
 * Authenticated proxy for every /api/hrm/* call.
 *
 * Forwards method, path, query string and body to Laravel's `/hrm/*` routes,
 * attaching the httpOnly bearer token server-side so it never reaches the
 * browser.
 *
 * The target path is `/hrm/...` and must stay that way. Rewriting it to match a
 * frontend route group is exactly the mistake that silently 404'd every admin
 * and instructor call during the suite restructure — the URL the browser asks
 * for and the URL the API serves are independent, and only one of them moves
 * when pages are reorganised.
 */
async function forward(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const target = `/hrm/${path.join("/")}${url.search}`;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody ? await req.text() : undefined;

  const result = await lmsFetch(target, {
    method,
    auth: true,
    body,
  });

  // A 204 must not carry a body: `Response.json({}, { status: 204 })` throws,
  // which turns every successful empty response into a 500 for the browser.
  if (result.status === 204) return new Response(null, { status: 204 });

  return Response.json(result.body ?? {}, { status: result.status });
}

/**
 * A document scan uploaded (H13), forwarded with its multipart boundary
 * intact. `lmsFetch` sends JSON and reads text, which would destroy both the
 * boundary and the bytes — the same lesson the Projects and media proxies
 * learnt.
 */
async function forwardUpload(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  const upstream = await fetch(`${API_URL}/hrm/${path.join("/")}${url.search}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      // Passed through, never set by us: setting it drops the boundary.
      "Content-Type": req.headers.get("content-type") ?? "application/octet-stream",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: await req.arrayBuffer(),
    cache: "no-store",
  });

  const text = await upstream.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { message: text };
    }
  }

  return Response.json(body ?? {}, { status: upstream.status });
}

/**
 * A document scan downloaded, passed through as bytes. Refusals (403, 404)
 * stay JSON with their status.
 */
async function forwardDownload(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  const upstream = await fetch(`${API_URL}/hrm/${path.join("/")}${url.search}`, {
    headers: {
      Accept: "application/json, */*",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  const headers = new Headers({ "Cache-Control": "private, no-store" });
  for (const name of ["content-type", "content-disposition", "content-length"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}

/** `documents/{id}/file` and `me/documents/{id}/file` are the only files here. */
function isDocumentFile(path: string[]): boolean {
  return path.at(-1) === "file" && path.at(-3) === "documents";
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path;

  if (isDocumentFile(path)) return forwardDownload(req, path);

  return forward(req, path);
}
export async function POST(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path;

  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    return forwardUpload(req, path);
  }

  return forward(req, path);
}
export async function PATCH(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function PUT(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
export async function DELETE(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
