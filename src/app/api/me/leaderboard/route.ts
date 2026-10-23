import { lmsFetch } from "@/lib/api/server";

/** The usage board: everyone at this learner's institution, by courses finished. */
export async function GET(req: Request) {
  const { search } = new URL(req.url);

  const result = await lmsFetch<{ data?: unknown }>(`/me/leaderboard${search}`, { auth: true });

  if (!result.ok) {
    return Response.json({ rows: [], you: null, total: 0 }, { status: result.status });
  }

  return Response.json((result.body as { data?: unknown }).data ?? { rows: [], you: null, total: 0 });
}
