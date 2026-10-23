import { cookies } from "next/headers";
import { AUTH_COOKIE, lmsFetch } from "@/lib/api/server";
import { explainFailure } from "@/lib/api/http-errors";

const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

/*
  Drafting a plan with AI runs for a minute or more (85 s was measured for a
  broad brief), and so does each epic's breakdown. Without this the host's
  default function limit cut those requests short and answered with a plain
  error page, which the screen could only call "Request failed.". Same limit
  as the upload proxy.
*/
export const maxDuration = 300;

/**
 * What goes back to the browser: the API's JSON as it came, or - when the
 * answer was not JSON (a timeout page, a crash page) - a JSON error that says
 * what happened, so the screen never has to guess.
 */
function reply(status: number, body: unknown): Response {
  if (status >= 400 && (body === null || typeof body !== "object")) {
    return Response.json({ message: explainFailure(status, body) }, { status });
  }

  return Response.json(body ?? {}, { status });
}

/** The API could not be reached at all, or stopped answering. */
function unreachable(e: unknown): Response {
  const timedOut = e instanceof Error && /timeout|aborted/i.test(`${e.name} ${e.message}`);

  return Response.json(
    { message: explainFailure(timedOut ? 504 : 502, timedOut ? "timeout" : undefined) },
    { status: timedOut ? 504 : 502 },
  );
}

/**
 * Authenticated proxy for every /api/projects/* call.
 *
 * Forwards method, path, query string and body to Laravel's `/projects/*`
 * routes, attaching the httpOnly bearer token server-side so it never reaches
 * the browser.
 *
 * The target path is `/projects/...` and must stay that way. Rewriting it to
 * match a frontend route group is the mistake that silently 404'd every admin
 * and instructor call during the suite restructure: the URL the browser asks
 * for and the URL the API serves are independent, and only one of them moves
 * when pages are reorganised.
 *
 * `api/projects/projects/...` is not a typo. The module prefix is `projects`
 * and so is its main collection — kept deliberately, because collapsing them
 * would put a wildcard beside `/portfolios` and let a project slugged
 * "portfolios" shadow a real endpoint. See the module's route file.
 */
/**
 * A file upload, forwarded with its boundary intact.
 *
 * `lmsFetch` sets `Content-Type: application/json` and reads the body as text,
 * which is right for every other call here and destroys a multipart one twice
 * over: the boundary in the incoming content type is what tells the far end
 * where each part begins, and decoding binary bytes as text corrupts them.
 *
 * So this path bypasses it — same shape as the media proxy, which learnt the
 * same lesson. The backlog importer is the only thing in this module that
 * uploads, and the only reason this branch exists.
 */
async function forwardUpload(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  let upstream: Response;

  try {
    upstream = await fetch(
      `${API_URL}/projects/${path.join("/")}${url.search}`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          // Never set by us. Setting it ourselves drops the boundary.
          "Content-Type": req.headers.get("content-type") ?? "application/octet-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: await req.arrayBuffer(),
        cache: "no-store",
      },
    );
  } catch (e) {
    return unreachable(e);
  }

  const text = await upstream.text();
  let body: unknown = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  return reply(upstream.status, body);
}

async function forward(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const target = `/projects/${path.join("/")}${url.search}`;

  const method = req.method.toUpperCase();
  const hasBody = method !== "GET" && method !== "HEAD" && method !== "DELETE";
  const body = hasBody ? await req.text() : undefined;

  let result: Awaited<ReturnType<typeof lmsFetch>>;

  try {
    result = await lmsFetch(target, { method, auth: true, body });
  } catch (e) {
    return unreachable(e);
  }

  /*
    204 carries no body, and `Response.json(null)` would send "null" with a
    status that promises nothing — which some clients parse and others reject.
  */
  if (result.status === 204) {
    return new Response(null, { status: 204 });
  }

  return reply(result.status, result.body);
}

/**
 * A file download, passed through as bytes.
 *
 * `forward` reads the upstream body as text, which is fine for JSON and
 * corrupts a spreadsheet. Two downloads in this module go through here: the
 * backlog template and the performance workbook. Their refusals (403, 404) are
 * still JSON and pass through unchanged with their status, which the client
 * reads as an error.
 */
async function forwardDownload(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  const upstream = await fetch(`${API_URL}/projects/${path.join("/")}${url.search}`, {
    headers: {
      Accept: "application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
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

type Ctx = { params: Promise<{ path: string[] }> };

export async function GET(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path;

  /*
    Only the backlog template and the performance workbook are files;
    everything else here is JSON.
  */
  if (
    (path.at(-1) === "template" && path.at(-2) === "imports") ||
    (path.at(-1) === "export" && path.at(-2) === "performance")
  ) {
    return forwardDownload(req, path);
  }

  return forward(req, path);
}
export async function POST(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path;

  /* Only the importer uploads; everything else here is JSON. */
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
