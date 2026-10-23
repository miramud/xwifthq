import { cookies } from "next/headers";
import { AUTH_COOKIE, lmsFetch, lmsFetchRaw } from "@/lib/api/server";

const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

/**
 * Route handlers for an authenticated `/api/{prefix}/*` proxy to Laravel.
 *
 * JSON in and out, status passed through; a path ending in `/pdf` streams the
 * file back as it came, with its download headers; a multipart upload (a bank
 * statement) goes through as bytes with its boundary intact - `lmsFetch`
 * would read it as text and set a JSON content type, breaking it twice over.
 * Who may do what is decided by Laravel - this only attaches the session
 * token.
 */
export function authenticatedProxy(prefix: string) {
  async function forwardUpload(req: Request, target: string): Promise<Response> {
    const token = (await cookies()).get(AUTH_COOKIE)?.value;

    const upstream = await fetch(`${API_URL}${target}`, {
      method: req.method.toUpperCase(),
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
    let body: unknown = {};

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = { message: text };
      }
    }

    return Response.json(body, { status: upstream.status });
  }

  async function forward(req: Request, path: string[] | undefined): Promise<Response> {
    const url = new URL(req.url);
    const segments = path ?? [];
    const target = `/${prefix}${segments.length ? `/${segments.join("/")}` : ""}${url.search}`;

    // Files come back as they are: printed PDFs, bank files, uploaded documents,
    // repository downloads (`…/download`), policy files, the bid pack (`…/file`) and workbooks (`…/xlsx`).
    const last = segments[segments.length - 1];
    const isFile =
      last === "pdf" || last === "xlsx" || last === "bank-file" || last === "download" || last === "file" || ["documents", "attachments"].includes(segments[segments.length - 2] ?? "");

    if (isFile && req.method === "GET") {
      const res = await lmsFetchRaw(target);
      if (!res.ok) {
        const text = await res.text();
        return new Response(text || "{}", { status: res.status, headers: { "Content-Type": "application/json" } });
      }
      return new Response(res.body, {
        status: 200,
        headers: {
          "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
          "Content-Disposition": res.headers.get("Content-Disposition") ?? "attachment",
          "Cache-Control": "private, no-store",
        },
      });
    }

    if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      return forwardUpload(req, target);
    }

    const method = req.method.toUpperCase();
    const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
    const body = hasBody ? await req.text() : undefined;
    const result = await lmsFetch(target, { method, auth: true, body: body || undefined });

    if (result.status === 204) return new Response(null, { status: 204 });
    return Response.json(result.body ?? {}, { status: result.status });
  }

  type Ctx = { params: Promise<{ path?: string[] }> };
  const handle = async (req: Request, ctx: Ctx) => forward(req, (await ctx.params).path);

  return { GET: handle, POST: handle, PUT: handle, PATCH: handle, DELETE: handle };
}
