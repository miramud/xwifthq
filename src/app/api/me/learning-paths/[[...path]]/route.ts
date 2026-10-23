import { lmsFetch } from "@/lib/api/server";

/** The learner's own learning paths, with live progress. */
export async function GET(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await ctx.params;
  const { search } = new URL(req.url);

  const target = `/me/learning-paths${path.length > 0 ? `/${path.join("/")}` : ""}${search}`;

  const result = await lmsFetch<{ data?: unknown }>(target, { auth: true });

  if (!result.ok) {
    return Response.json(
      { paths: [], path: null, board: null },
      { status: result.status === 401 ? 401 : result.status },
    );
  }

  const data = (result.body as { data?: unknown }).data ?? null;

  // A path's leaderboard is also an object, so it needs a key of its own or the
  // client would read a ranking as a path.
  if (path.at(-1) === "leaderboard") {
    return Response.json({ board: data });
  }

  // The list endpoint returns an array, the detail endpoint one object; the
  // client picks whichever key it asked for.
  return Response.json(Array.isArray(data) ? { paths: data } : { path: data });
}
