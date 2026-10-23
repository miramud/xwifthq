import { lmsFetch } from "@/lib/api/server";

/**
 * The learner's own certificates.
 *
 * Distinct from `/api/certificates/{serial}`, which is the public verification
 * read and needs no session. This one answers "what have I earned", which is
 * the question somebody has when a registrar asks them to evidence their
 * training and they are holding nothing but a course they remember finishing.
 */
export async function GET() {
  const result = await lmsFetch<{ data?: unknown }>("/me/certificates", {
    auth: true,
  });

  if (!result.ok) {
    return Response.json(
      { certificates: [] },
      { status: result.status === 401 ? 401 : result.status },
    );
  }

  const data = (result.body as { data?: unknown }).data ?? [];

  return Response.json({ certificates: Array.isArray(data) ? data : [] });
}
