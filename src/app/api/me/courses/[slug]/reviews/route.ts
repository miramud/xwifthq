import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/** Write or update this learner's review of a course they own. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.text();

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/courses/${encodeURIComponent(slug)}/reviews`,
    { method: "POST", auth: true, body },
  );

  if (!result.ok) {
    return Response.json(
      {
        message: lmsErrorMessage(result.body, "Could not save your review."),
        errors: (result.body as Record<string, unknown>)?.errors,
      },
      { status: result.status },
    );
  }

  const parsed = result.body as { data?: unknown };
  return Response.json({ review: parsed.data ?? null });
}

/** Withdraw it again. */
export async function DELETE(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const result = await lmsFetch(`/me/courses/${encodeURIComponent(slug)}/reviews`, {
    method: "DELETE",
    auth: true,
  });

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not remove your review.") },
      { status: result.status },
    );
  }

  return Response.json({ ok: true });
}
