import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/** The learner's own finished attempts at one quiz, with their answers. */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { search } = new URL(req.url);

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/courses/${encodeURIComponent(slug)}/quiz/attempts${search}`,
    { auth: true },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not load your attempts.") },
      { status: result.status },
    );
  }

  return Response.json({ attempts: (result.body as { data?: unknown }).data ?? [] });
}
