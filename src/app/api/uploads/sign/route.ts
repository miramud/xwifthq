import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/api/server";

/**
 * Mints a Cloudinary upload signature for the browser. This is a tiny JSON
 * round-trip (just `{ kind }` in, a signature out) — the file itself is uploaded
 * straight from the browser to Cloudinary, never through this server. That is
 * what lets large lecture videos work on Vercel, whose functions cap the request
 * body at ~4.5 MB, in front of a shared-hosting Laravel API.
 */
const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

export async function POST(req: Request): Promise<Response> {
  const body = await req.text();
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  const res = await fetch(`${API_URL}/uploads/sign`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body,
    cache: "no-store",
  });

  const text = await res.text();

  return new Response(text || "{}", {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
