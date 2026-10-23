import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/api/server";

/**
 * Multipart proxy for the bulk-learner CSV import.
 *
 * It cannot go through the generic `/api/admin/[...path]` catch-all: that
 * reads the body as text and sets a JSON content-type, which corrupts a file
 * upload. Being a more specific route, Next matches this ahead of the
 * catch-all.
 *
 * The response carries one-time generated passwords, so it is never cached.
 */
const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  const res = await fetch(`${API_URL}/admin/students/import`, {
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
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "application/json",
      // Credentials in the body: keep them out of every cache on the way back.
      "Cache-Control": "no-store, max-age=0",
    },
  });
}
