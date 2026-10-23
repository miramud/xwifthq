import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/**
 * The signed-in learner's progress across every course they hold.
 *
 * Shaped `{ data }` rather than flattened, because `progress-client.ts` reads
 * the same envelope from here and from the admin routes — one parser for both
 * sides of the same report.
 */
export async function GET(req: Request) {
  const days = new URL(req.url).searchParams.get("days");
  const query = days ? `?days=${encodeURIComponent(days)}` : "";

  const result = await lmsFetch<{ data?: unknown }>(`/me/progress${query}`, { auth: true });

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not load your progress.") },
      { status: result.status },
    );
  }

  return Response.json({ data: (result.body as { data?: unknown }).data ?? null });
}
