/**
 * Forwards a course-detail page view to Laravel, which records it for the
 * traffic-source and funnel analytics.
 *
 * Fire-and-forget by design: a tracking failure must never surface to the
 * learner, so every outcome is a 202.
 */
const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const body = await req.text();

  try {
    await fetch(`${API_URL}/courses/${encodeURIComponent(slug)}/view`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: body || "{}",
      cache: "no-store",
    });
  } catch {
    // Analytics is not worth an error boundary.
  }

  return new Response(null, { status: 202 });
}
