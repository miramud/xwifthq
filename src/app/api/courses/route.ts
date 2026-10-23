/**
 * Public course catalog, proxied so client components (the cart's suggestion
 * grid, for example) can read it same-origin. Server components should keep
 * using `getCourses()` from `@/lib/api/public` instead.
 */
const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

export const revalidate = 300;

export async function GET(req: Request): Promise<Response> {
  const incoming = new URL(req.url);
  const params = new URLSearchParams(incoming.search);
  if (!params.has("perPage")) params.set("perPage", "24");

  try {
    const res = await fetch(`${API_URL}/courses?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });

    if (!res.ok) return Response.json({ courses: [] });

    const body = (await res.json()) as { data?: unknown[] };
    return Response.json({ courses: body.data ?? [] });
  } catch {
    // Backend down: an empty catalog renders an empty state, not invented courses.
    return Response.json({ courses: [] });
  }
}
