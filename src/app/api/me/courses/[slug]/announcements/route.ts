import { lmsFetch } from "@/lib/api/server";

/** Announcements on one course, plus that instructor's broadcasts. */
export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;

  const result = await lmsFetch<{ data?: unknown }>(
    `/me/courses/${encodeURIComponent(slug)}/announcements`,
    { auth: true },
  );

  if (!result.ok) {
    return Response.json({ announcements: [] }, { status: result.status === 401 ? 401 : 200 });
  }

  const body = result.body as { data?: unknown };
  return Response.json({ announcements: body.data ?? [] });
}
