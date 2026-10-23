import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/**
 * The enrolled learner's lesson payload: real video URLs, article HTML and quiz
 * questions (with the answer keys stripped server-side).
 */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const result = await lmsFetch<{ data?: unknown }>(`/me/courses/${encodeURIComponent(slug)}/content`, {
    auth: true,
  });

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not load this course.") },
      { status: result.status },
    );
  }

  const body = result.body as { data?: unknown };
  return Response.json({ course: body.data ?? null });
}
