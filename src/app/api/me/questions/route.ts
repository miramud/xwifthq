import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

/** The signed-in learner's own Q&A threads. */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);

  const result = await lmsFetch<{ data?: unknown[] }>(`/me/questions${url.search}`, { auth: true });

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Could not load your questions.") },
      { status: result.status },
    );
  }

  const body = result.body as { data?: unknown[] };
  return Response.json({ questions: body.data ?? [] });
}
