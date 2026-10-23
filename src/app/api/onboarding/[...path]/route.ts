import { cookies } from "next/headers";
import { AUTH_COOKIE, lmsFetch } from "@/lib/api/server";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

/**
 * Public proxy for new-organisation onboarding (`/api/onboarding/*`).
 *
 * Quote and checkout pass straight through. Verify is the one place this
 * layer does something: when the API confirms the payment *and* the buyer's
 * browser presented the claim token it was given at checkout, the response
 * carries a session for the new admin. That token becomes the same httpOnly
 * cookie a normal sign-in sets, and is removed from what the browser sees —
 * the page learns only that it is now signed in.
 */
async function forward(req: Request, path: string[]): Promise<Response> {
  const url = new URL(req.url);
  const target = path.join("/");
  const body = await req.text();

  const result = await lmsFetch(`/onboarding/${target}${url.search}`, { method: "POST", body });

  if (result.status === 204) return new Response(null, { status: 204 });

  if (target !== "verify" || !result.ok) {
    return Response.json(result.body ?? {}, { status: result.status });
  }

  const payload = (result.body ?? {}) as { data?: Record<string, unknown> & { session?: { token?: string } | null } };
  const data = payload.data ?? {};
  const token = typeof data.session?.token === "string" ? data.session.token : null;

  if (token) {
    (await cookies()).set(AUTH_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: THIRTY_DAYS,
    });
  }

  const { session: _session, ...rest } = data;
  void _session;

  return Response.json({ data: { ...rest, signedIn: token !== null } }, { status: result.status });
}

type Ctx = { params: Promise<{ path: string[] }> };

export async function POST(req: Request, ctx: Ctx) {
  return forward(req, (await ctx.params).path);
}
