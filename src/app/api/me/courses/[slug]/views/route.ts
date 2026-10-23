import { lmsFetch } from "@/lib/api/server";

/**
 * Playback telemetry from the learner's own player.
 *
 * Fire-and-forget by design: a dropped progress ping is a slightly shorter
 * retention curve, and blocking a video on it would be absurd.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.text();

  const result = await lmsFetch<unknown>(
    `/me/courses/${encodeURIComponent(slug)}/views`,
    { method: "POST", auth: true, body },
  );

  return new Response(null, { status: result.ok ? 204 : result.status });
}
