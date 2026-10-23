import { lmsFetch } from "@/lib/api/server";

/** Instructor announcements addressed to this learner, across their courses. */
export async function GET(req: Request) {
  const { search } = new URL(req.url);

  const result = await lmsFetch<{ data?: unknown }>(`/me/announcements${search}`, { auth: true });

  if (!result.ok) {
    return Response.json({ announcements: [] }, { status: result.status === 401 ? 401 : 200 });
  }

  const body = result.body as { data?: unknown };
  return Response.json({ announcements: body.data ?? [] });
}
