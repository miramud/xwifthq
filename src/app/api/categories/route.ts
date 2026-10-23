/**
 * Public category taxonomy, proxied so client components (catalog filters, the
 * course wizard, admin/instructor pickers) can read it same-origin.
 *
 * The upstream endpoint needs no auth, so this is cached briefly rather than
 * being marked no-store.
 */
const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

export const revalidate = 300;

export async function GET(): Promise<Response> {
  try {
    const res = await fetch(`${API_URL}/categories`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
    });

    if (!res.ok) return Response.json({ categories: [] }, { status: 200 });

    const body = (await res.json()) as { data?: unknown[] };
    return Response.json({ categories: body.data ?? [] });
  } catch {
    // Backend down: an empty taxonomy renders an empty filter, not a crash.
    return Response.json({ categories: [] }, { status: 200 });
  }
}
