import { cookies } from "next/headers";
import { AUTH_COOKIE, lmsFetch, lmsErrorMessage } from "@/lib/api/server";

const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

/**
 * The media library: list, upload, link, fetch one, forget one.
 *
 * An upload is the one request in the suite that cannot go through
 * `lmsFetch`, which sets `Content-Type: application/json` on everything. A
 * multipart body carries a generated boundary in its own content type, and
 * rewriting that header makes the file unparseable at the other end — so the
 * upload path forwards the raw bytes and the original header untouched.
 *
 * The cost is that the file is buffered here on its way past. The API's own
 * signed-upload endpoint exists for the browser-straight-to-Cloudinary case
 * and is still what the legacy course uploader uses; this route is the
 * provider-agnostic one, and goes wherever the institution has configured.
 */
function target(path: string[] = [], search = ""): string {
  return `/media${path.length > 0 ? `/${path.join("/")}` : ""}${search}`;
}

/**
 * Serve a platform-only file.
 *
 * `playbackUrl()` hands a player `/api/media/{id}/stream` — a path on *this*
 * origin, because the provider location is the one thing platform-only media
 * must never put in a browser. So the bytes have to come back through here.
 *
 * Three things this must not do, each of which quietly breaks playback:
 * it must not parse the body as JSON, it must not buffer a 2 GB lecture into
 * memory, and it must not drop the `Range` header — without it a browser
 * cannot seek, and dragging the scrub bar refetches the file from the start.
 * The upstream response body is handed straight back, so the proxy holds
 * chunks rather than the file.
 */
async function streamThrough(req: Request, path: string[]): Promise<Response> {
  const token = (await cookies()).get(AUTH_COOKIE)?.value;
  const range = req.headers.get("range");

  const upstream = await fetch(`${API_URL}${target(path)}`, {
    headers: {
      ...(range ? { Range: range } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
  });

  if (!upstream.ok && upstream.status !== 206) {
    return Response.json(
      { message: "That file could not be opened." },
      { status: upstream.status },
    );
  }

  const headers = new Headers();

  /* Only what a player needs. Nothing upstream sets about *our* session. */
  for (const name of [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "content-disposition",
    "cache-control",
    "x-content-type-options",
  ]) {
    const value = upstream.headers.get(name);

    if (value !== null) headers.set(name, value);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;
  const { search } = new URL(req.url);

  if (path.length === 2 && path[1] === "stream") {
    return streamThrough(req, path);
  }

  const result = await lmsFetch<{ data?: unknown; meta?: unknown }>(
    target(path, search),
    { auth: true },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not load the media library.") },
      { status: result.status },
    );
  }

  const body = result.body as { data?: unknown; meta?: unknown };

  return Response.json({ data: body.data ?? [], meta: body.meta ?? null });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;

  /* A pasted link is ordinary JSON and needs none of the below. */
  if (path[0] === "link") {
    const result = await lmsFetch<{ data?: unknown }>(target(path), {
      method: "POST",
      auth: true,
      body: await req.text(),
    });

    if (!result.ok) {
      return Response.json(
        { message: lmsErrorMessage(result.body, "Could not save that link.") },
        { status: result.status },
      );
    }

    return Response.json({ data: (result.body as { data?: unknown }).data ?? null });
  }

  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  const upstream = await fetch(`${API_URL}${target(path)}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      // Passed through with its boundary intact. Setting it ourselves is the
      // classic way to break a multipart upload.
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
      body = text;
    }
  }

  if (!upstream.ok) {
    return Response.json(
      { message: lmsErrorMessage(body, "That file could not be uploaded.") },
      { status: upstream.status },
    );
  }

  return Response.json({ data: (body as { data?: unknown })?.data ?? null });
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ path?: string[] }> },
) {
  const { path = [] } = await ctx.params;

  const result = await lmsFetch(target(path), { method: "DELETE", auth: true });

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "That file could not be removed.") },
      { status: result.status },
    );
  }

  return new Response(null, { status: 204 });
}
