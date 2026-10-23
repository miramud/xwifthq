import { cookies } from "next/headers";
import { AUTH_COOKIE, lmsFetch, lmsErrorMessage } from "@/lib/api/server";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

export async function POST(req: Request) {
  const payload = await req.json();

  const result = await lmsFetch("/auth/register", {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!result.ok) {
    return Response.json(
      {
        message: lmsErrorMessage(result.body, "Could not create your account."),
        errors: (result.body as Record<string, unknown>)?.errors,
      },
      { status: result.status },
    );
  }

  // /auth/register returns the UserResource wrapped in `data`, with `token` alongside it.
  const { token, data, ...rest } = result.body as Record<string, unknown> & { token: string };
  const user = data ?? rest;

  (await cookies()).set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: THIRTY_DAYS,
  });

  return Response.json({ user });
}
