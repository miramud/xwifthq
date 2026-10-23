import { cookies } from "next/headers";
import { AUTH_COOKIE, lmsFetch } from "@/lib/api/server";

export async function POST() {
  // Best-effort server-side revoke; ignore failures (token may already be gone).
  await lmsFetch("/auth/logout", { method: "POST", auth: true }).catch(() => null);

  (await cookies()).delete(AUTH_COOKIE);

  return Response.json({ ok: true });
}
