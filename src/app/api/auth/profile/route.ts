import { lmsFetch } from "@/lib/api/server";

/** Update the signed-in user's own name and photo. `email` is not writable. */
export async function PUT(req: Request) {
  const body = await req.text();

  const result = await lmsFetch("/auth/profile", { method: "PUT", auth: true, body });

  // A 204 must not carry a body: `Response.json({}, { status: 204 })` throws,
  // which turns every successful empty response into a 500 for the browser.
  if (result.status === 204) return new Response(null, { status: 204 });

  return Response.json(result.body ?? {}, { status: result.status });
}
