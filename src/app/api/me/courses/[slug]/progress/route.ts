import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/** Persist lesson progress so it survives a change of device. */
export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.text();

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/courses/${encodeURIComponent(slug)}/progress`,
    { method: "POST", auth: true, body },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not save your progress.") },
      { status: result.status },
    );
  }

  const parsed = result.body as { data?: unknown };
  return Response.json({ enrollment: parsed.data ?? null });
}

/**
 * The learner's own progress report for one course: the daily series, the
 * section breakdown, and where they left off.
 *
 * Same path as the POST above, which is deliberate — reading and writing
 * progress are the same resource, and splitting them across two URLs would
 * mean two proxies to keep in step.
 */
export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const days = new URL(req.url).searchParams.get("days");
  const query = days ? `?days=${encodeURIComponent(days)}` : "";

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/courses/${encodeURIComponent(slug)}/progress${query}`,
    { auth: true },
  );

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not load your progress.") },
      { status: result.status },
    );
  }

  return Response.json({ data: (result.body as { data?: unknown }).data ?? null });
}
