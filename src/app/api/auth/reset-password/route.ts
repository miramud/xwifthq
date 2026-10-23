import { lmsFetch } from "@/lib/api/server";

/**
 * Set a new password from an emailed reset link.
 *
 * Public, and deliberately does not sign anybody in: the browser signs in with
 * the new password through the ordinary login route afterwards, so there is
 * one place that sets the session cookie. The body (token and password
 * included) is forwarded untouched and never logged.
 */
export async function POST(req: Request) {
  const body = await req.text();

  const result = await lmsFetch("/auth/reset-password", { method: "POST", body });

  if (result.status === 204) return new Response(null, { status: 204 });

  return Response.json(result.body ?? {}, { status: result.status });
}
