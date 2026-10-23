import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/** Who currently holds this course, and how they came by it. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const result = await lmsFetch<{ data?: unknown }>(
    `/courses/${encodeURIComponent(slug)}/assignments`,
    { auth: true },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not load the roster.") },
      { status: result.status },
    );
  }

  return Response.json({ roster: (result.body as { data?: unknown }).data ?? [] });
}

/** Grant this course to one or many learners. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.text();

  const result = await lmsFetch<{ data?: unknown }>(
    `/courses/${encodeURIComponent(slug)}/assignments`,
    { method: "POST", auth: true, body },
  );

  if (!result.ok) {
    return Response.json(
      {
        message: lmsErrorMessage(result.body, "Could not assign this course."),
        errors: (result.body as Record<string, unknown>)?.errors,
      },
      { status: result.status },
    );
  }

  return Response.json({ result: (result.body as { data?: unknown }).data ?? null });
}
