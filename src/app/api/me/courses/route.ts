import { lmsFetch } from "@/lib/api/server";

export async function GET() {
  const result = await lmsFetch("/me/courses", { method: "GET", auth: true });

  if (!result.ok) {
    return Response.json({ courses: [] }, { status: result.status === 401 ? 401 : 200 });
  }

  const body = result.body as { data?: unknown };
  return Response.json({ courses: body.data ?? [] });
}
