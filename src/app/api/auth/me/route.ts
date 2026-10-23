import { lmsFetch } from "@/lib/api/server";

export async function GET() {
  const result = await lmsFetch("/auth/me", { method: "GET", auth: true });

  if (!result.ok) {
    return Response.json({ user: null }, { status: 200 });
  }

  // /auth/me returns the UserResource wrapped in `data`.
  const body = result.body as { data?: unknown };
  return Response.json({ user: body.data ?? body });
}
