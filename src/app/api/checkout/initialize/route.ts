import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

export async function POST(req: Request) {
  const payload = await req.json();

  const result = await lmsFetch("/checkout/initialize", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    return Response.json(
      {
        message: lmsErrorMessage(result.body, "Could not start checkout."),
        errors: (result.body as Record<string, unknown>)?.errors,
      },
      { status: result.status },
    );
  }

  const body = result.body as { data?: unknown };
  return Response.json({ order: body.data ?? body });
}
