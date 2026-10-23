import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/** Open a new Q&A thread against a course the learner is enrolled in. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.text();

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/courses/${encodeURIComponent(slug)}/questions`,
    { method: "POST", auth: true, body },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not post your question.") },
      { status: result.status },
    );
  }

  const parsed = result.body as { data?: unknown };
  return Response.json({ question: parsed.data ?? null });
}
