import { lmsFetch } from "@/lib/api/server";

/**
 * Change the signed-in user's password.
 *
 * The whole body (current password included) is forwarded untouched so Laravel
 * does the checking; nothing is inspected or logged here. The backend revokes
 * every *other* Sanctum token, so this session's httpOnly cookie stays valid and
 * the user is not signed out of the tab they just used.
 */
export async function PUT(req: Request) {
  const body = await req.text();

  const result = await lmsFetch("/auth/password", { method: "PUT", auth: true, body });

  // A 204 must not carry a body: `Response.json({}, { status: 204 })` throws,
  // which turns every successful empty response into a 500 for the browser.
  if (result.status === 204) return new Response(null, { status: 204 });

  return Response.json(result.body ?? {}, { status: result.status });
}
