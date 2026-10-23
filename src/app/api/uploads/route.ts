import { cookies } from "next/headers";
import { AUTH_COOKIE } from "@/lib/api/server";

/**
 * Multipart proxy for course-media uploads, shared by the instructor studio and
 * the admin course editor.
 *
 * It cannot go through the generic `[...path]` proxies: those read the body as
 * text and set a JSON content-type, which corrupts file uploads. Here the
 * FormData is streamed straight to Laravel with the httpOnly bearer token
 * attached server-side.
 */
const API_URL = process.env.LMS_API_URL ?? "http://localhost:8000/api";

/** Uploads can be large; give Laravel time to hand the file to Cloudinary. */
export const maxDuration = 300;

export async function POST(req: Request): Promise<Response> {
  const form = await req.formData();
  const token = (await cookies()).get(AUTH_COOKIE)?.value;

  const res = await fetch(`${API_URL}/uploads`, {
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
