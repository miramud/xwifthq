import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/**
 * Grade a quiz lecture. Grading is server-side because the learner-facing
 * payload has no answer key in it.
 */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.text();

  const result = await lmsFetch<{ data?: unknown }>(`/me/courses/${encodeURIComponent(slug)}/quiz`, {
    method: "POST",
    auth: true,
    body,
  });

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not grade this quiz.") },
      { status: result.status },
    );
  }

  const parsed = result.body as { data?: unknown };
  return Response.json({ result: parsed.data ?? null });
}
