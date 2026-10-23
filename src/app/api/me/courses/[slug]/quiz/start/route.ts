import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/**
 * Open a sitting.
 *
 * Called unconditionally by the player: a plain quiz gets its questions back
 * with no session, and a rationed one gets a sitting with a clock, a drawn set
 * and an id to submit against.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.text();

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/courses/${encodeURIComponent(slug)}/quiz/start`,
    { method: "POST", auth: true, body },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not start this quiz.") },
      { status: result.status },
    );
  }

  return Response.json({ result: (result.body as { data?: unknown }).data ?? null });
}
