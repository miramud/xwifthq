const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

/**
 * A shared document's bytes, for somebody with no account.
 *
 * **Its own route, not the `/api/projects/*` proxy.** That proxy reads the
 * auth cookie and returns JSON; this one attaches nothing and streams binary.
 * Keeping them apart means the authenticated proxy never has to reason about a
 * caller who might not be signed in, which is the kind of branch that gets
 * subtly wrong later.
 *
 * **Nothing is decided here.** The API checks that the document belongs to the
 * share's project and is marked shared — see `SharedProjectController`. This
 * forwards a path and passes the response through. A proxy that made its own
 * access decision would be a second place for that rule to live, and the two
 * would eventually disagree.
 *
 * The response is streamed rather than buffered: a client's twenty-megabyte
 * specification should not sit in this process's memory on its way past.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ token: string; document: string }> },
) {
  const { token, document } = await ctx.params;

  const upstream = await fetch(
    `${API_URL}/projects/shared/${encodeURIComponent(token)}/documents/${encodeURIComponent(document)}`,
    { headers: { Accept: "*/*" }, cache: "no-store" },
  );

  if (!upstream.ok || upstream.body === null) {
    /* The same answer for every reason. See the controller. */
    return new Response("Not found", { status: 404 });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/octet-stream",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ?? 'inline; filename="document"',
      /*
       * Carried through rather than assumed. This URL needs no session, so a
       * CDN or corporate proxy holding the body would serve one client's
       * contract to whoever asked next.
       */
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
