import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/**
 * Withdraw a granted seat.
 *
 * The API refuses this for a *purchased* seat with a 422 — that is a refund,
 * not a revocation — and the message it returns says so, which is why the
 * error is passed straight through rather than replaced with a generic one.
 */
export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ slug: string; studentId: string }> },
) {
  const { slug, studentId } = await ctx.params;

  const result = await lmsFetch(
    `/courses/${encodeURIComponent(slug)}/assignments/${encodeURIComponent(studentId)}`,
    { method: "DELETE", auth: true },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not revoke this assignment.") },
      { status: result.status },
    );
  }

  return Response.json({ ok: true });
}
