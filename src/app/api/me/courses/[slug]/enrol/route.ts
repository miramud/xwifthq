import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/**
 * Put the signed-in learner on a course.
 *
 * Courses are free, so this replaced the old checkout hop entirely — there is
 * no cart, no order and no gateway. The API is idempotent and answers 200 for
 * a course the learner already holds, so the button can be pressed twice
 * without reading as an error.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/courses/${encodeURIComponent(slug)}/enrol`,
    { method: "POST", auth: true },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not start this course.") },
      { status: result.status },
    );
  }

  return Response.json(
    { enrollment: (result.body as { data?: unknown }).data ?? null },
    // 201 for a new enrollment, 200 for one they already had.
    { status: result.status },
  );
}
