import { lmsFetch, lmsErrorMessage } from "@/lib/api/server";

export async function POST(req: Request) {
  const payload = await req.json();

  const result = await lmsFetch("/checkout/verify", {
    method: "POST",
    auth: true,
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    return Response.json(
      { message: lmsErrorMessage(result.body, "Payment could not be verified."), status: "failed" },
      { status: result.status },
    );
  }

  const body = result.body as { data?: unknown };
  return Response.json({ order: body.data ?? body, status: "success" });
}
