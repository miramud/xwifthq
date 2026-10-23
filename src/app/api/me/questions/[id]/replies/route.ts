import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/** The learner adds a follow-up to their own thread. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.text();

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/questions/${encodeURIComponent(id)}/replies`,
    { method: "POST", auth: true, body },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not post your reply.") },
      { status: result.status },
    );
  }

  const parsed = result.body as { data?: unknown };
  return Response.json({ question: parsed.data ?? null });
}
