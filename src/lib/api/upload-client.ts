/* ------------------------------------------------------------------ */
/*  Browser-side media uploader, shared by the instructor studio and    */
/*  the admin course editor.                                            */
/*                                                                      */
/*  Files are uploaded DIRECTLY from the browser to Cloudinary. Our own  */
/*  servers only mint a short-lived signature (a tiny JSON call to       */
/*  /api/uploads/sign). Nothing large flows through Next or Laravel, so   */
/*  hundreds-of-MB lecture videos work even with the Vercel ~4.5 MB       */
/*  function-body cap in front of a shared-hosting API.                  */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";

export type MediaKind = "video" | "audio" | "image" | "document";

export interface UploadResult {
  url: string;
  publicId: string;
  provider: string;
  kind: MediaKind;
  name: string;
  size: number;
  mime: string | null;
  format: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  /** Legacy alias for `publicId`. */
  path: string;
}

/** What POST /api/uploads/sign returns — everything needed to post to Cloudinary. */
interface SignedUpload {
  endpoint: string;
  params: Record<string, string | number>;
  kind: MediaKind;
  resourceType: string;
  maxBytes: number;
  mimetypes: string[];
}

/**
 * Upload a file and return the stored asset. `onProgress` receives 0–100 while
 * the bytes are in flight — `fetch` cannot report upload progress, so the
 * transfer to Cloudinary uses XMLHttpRequest, which can. Large lecture videos
 * otherwise look frozen.
 */
export async function uploadMedia(
  file: File,
  kind: MediaKind = "video",
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<UploadResult> {
  // 1. Get a signature. Small request — safe under any platform body cap.
  const signed = await requestSignature(kind, signal);

  // 2. Fail fast, before a big upload, on anything the server would reject.
  if (signed.maxBytes && file.size > signed.maxBytes) {
    throw new ApiError(
      `This file is ${formatBytes(file.size)}. The limit for ${kind} is ${formatBytes(signed.maxBytes)}.`,
      413,
    );
  }
  if (file.type && signed.mimetypes.length > 0 && !signed.mimetypes.includes(file.type)) {
    throw new ApiError(`${file.type || "That file type"} isn't allowed for ${kind}.`, 415);
  }

  // 3. Upload the file straight to Cloudinary.
  const cloud = await postToCloudinary(signed, file, onProgress, signal);

  // 4. Normalise Cloudinary's response into our provider-agnostic shape.
  const publicId = String(cloud.public_id ?? "");
  return {
    url: String(cloud.secure_url ?? cloud.url ?? ""),
    publicId,
    provider: "cloudinary",
    kind,
    name: file.name || String(cloud.original_filename ?? publicId),
    size: Number(cloud.bytes ?? file.size) || 0,
    mime: file.type || null,
    format: cloud.format != null ? String(cloud.format) : null,
    duration: cloud.duration != null ? Number(cloud.duration) : null,
    width: cloud.width != null ? Number(cloud.width) : null,
    height: cloud.height != null ? Number(cloud.height) : null,
    path: publicId,
  };
}

/** Ask our backend (via the Next proxy) for a Cloudinary upload signature. */
async function requestSignature(kind: MediaKind, signal?: AbortSignal): Promise<SignedUpload> {
  const res = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind }),
    signal,
  });

  const body = (await res.json().catch(() => ({}))) as {
    data?: SignedUpload;
    message?: string;
    errors?: Record<string, string[]>;
  };

  if (!res.ok || !body.data) {
    throw new ApiError(
      body.message ?? firstError(body.errors) ?? "Could not start the upload.",
      res.status,
      body.errors,
    );
  }

  return body.data;
}

/** Cloudinary's upload JSON (only the fields we read). */
interface CloudinaryResponse {
  secure_url?: string;
  url?: string;
  public_id?: string;
  original_filename?: string;
  bytes?: number;
  format?: string;
  duration?: number;
  width?: number;
  height?: number;
  error?: { message?: string };
}

/** XHR upload to Cloudinary with progress + abort support. */
function postToCloudinary(
  signed: SignedUpload,
  file: File,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<CloudinaryResponse> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    // The signed params must be sent exactly as Cloudinary signed them.
    for (const [key, value] of Object.entries(signed.params)) {
      form.append(key, String(value));
    }
    form.append("file", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", signed.endpoint);
    xhr.responseType = "json";

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      const body = (xhr.response ?? {}) as CloudinaryResponse;
      if (xhr.status >= 200 && xhr.status < 300 && (body.secure_url || body.url)) {
        resolve(body);
      } else {
        reject(new ApiError(body.error?.message ?? "Upload failed. Please try again.", xhr.status));
      }
    };

    xhr.onerror = () => reject(new ApiError("Upload failed. Check your connection.", 0));
    xhr.onabort = () => reject(new ApiError("Upload cancelled.", 0));

    signal?.addEventListener("abort", () => xhr.abort(), { once: true });

    xhr.send(form);
  });
}

function firstError(errors?: Record<string, string[]>): string | undefined {
  return errors ? Object.values(errors)[0]?.[0] : undefined;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Back-compat shim for callers that only ever uploaded lecture video. */
export function uploadLectureVideo(file: File): Promise<UploadResult> {
  return uploadMedia(file, "video");
}

export { ApiError };
