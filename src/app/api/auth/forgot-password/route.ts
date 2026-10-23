import { lmsFetch } from "@/lib/api/server";

/**
 * Ask for a password reset link.
 *
 * Public: the person asking is signed out by definition. The API answers the
 * same generic 200 whether or not the address has an account, so this passes
 * the status and body straight through and never adds anything that could
 * tell the two apart.
 */
export async function POST(req: Request) {
  const body = await req.text();

  const result = await lmsFetch("/auth/forgot-password", { method: "POST", body });

  if (result.status === 204) return new Response(null, { status: 204 });

  return Response.json(result.body ?? {}, { status: result.status });
}
