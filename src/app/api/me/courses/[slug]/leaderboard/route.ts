import { lmsFetch } from "@/lib/api/server";

/**
 * One course's board.
 *
 * The API refuses this with a 404 for anyone not enrolled, so the status is
 * passed through rather than flattened — "you are not on this course" is a
 * different thing for the screen to say than "there is nobody here yet".
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { search } = new URL(req.url);

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/courses/${encodeURIComponent(slug)}/leaderboard${search}`,
    { auth: true },
  );

  if (!result.ok) {
    return Response.json({ rows: [], you: null, total: 0 }, { status: result.status });
  }

  return Response.json((result.body as { data?: unknown }).data ?? { rows: [], you: null, total: 0 });
}
