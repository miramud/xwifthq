import { lmsFetch } from "@/lib/api/server";

/** Every review this learner has written, newest first. */
export async function GET() {
  const result = await lmsFetch<{ data?: unknown }>("/me/reviews", { auth: true });

  if (!result.ok) {
    return Response.json({ reviews: [] }, { status: result.status === 401 ? 401 : 200 });
  }

  const body = result.body as { data?: unknown };
  return Response.json({ reviews: body.data ?? [] });
}
