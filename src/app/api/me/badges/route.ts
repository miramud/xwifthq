import { lmsFetch } from "@/lib/api/server";

/** The signed-in learner's own badges, plus the milestone they are closest to. */
export async function GET() {
  const result = await lmsFetch<{ data?: unknown }>("/me/badges", { auth: true });

  if (!result.ok) {
    return Response.json({ badges: [], counts: null, nextMilestone: null }, { status: result.status });
  }

  return Response.json((result.body as { data?: unknown }).data ?? { badges: [], counts: null, nextMilestone: null });
}
