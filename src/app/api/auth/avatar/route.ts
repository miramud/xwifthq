import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/api/server";

/**
 * Multipart proxy for profile-photo uploads, available to every signed-in role.
 *
 * Like /api/uploads this cannot use `lmsFetch`, which reads the body as text and
 * sets a JSON content-type — that corrupts the file. The FormData is streamed
 * straight to Laravel with the httpOnly bearer token attached server-side.
 */
const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  const res = await fetch(`${API_URL}/auth/avatar`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
    cache: "no-store",
  });

  const text = await res.text();

  return new Response(text || "{}", {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") ?? "application/json" },
  });
}
