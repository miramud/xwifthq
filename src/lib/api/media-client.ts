/*
 * The media library — the institution's own files, wherever they are kept.
 *
 * Separate from `upload-client.ts`, which signs a browser-straight-to-
 * Cloudinary upload and hands back a bare URL. This one returns a *media
 * asset*: a record the suite can stream through its own API, keep off the
 * public internet, re-use across lessons, and later forget.
 */

import { ApiError } from "@/lib/api/admin-client";

export type MediaKind = "video" | "image" | "document" | "audio" | "archive";

export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaKind;
  kindLabel: string;
  source: string;
  provider: string;
  providerLabel: string;
  visibility: string;
  /** Streamed through the API; the provider's own location never leaves it. */
  isPlatformOnly: boolean;
  /** A pasted link rather than a file we hold. */
  isExternal: boolean;
  externalHost: string | null;
  /** The only field a player should use. Everything else is context. */
  url: string | null;
  embedUrl: string | null;
  mime: string | null;
  sizeBytes: number | null;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  uploadedAt: string | null;
}

export interface MediaPage {
  data: MediaAsset[];
  meta: {
    total: number;
    perPage: number;
    currentPage: number;
    lastPage: number;
  } | null;
}

async function json<T>(res: Response): Promise<T> {
  const body = (await res.json().catch(() => ({}))) as { message?: string };

  if (!res.ok) {
    throw new ApiError(body?.message ?? "Request failed.", res.status);
  }

  return body as T;
}

export const media = {
  list: (filters: { kind?: MediaKind; q?: string; perPage?: number } = {}) => {
    const qs = new URLSearchParams();

    if (filters.kind) qs.set("kind", filters.kind);
    if (filters.q) qs.set("q", filters.q);
    if (filters.perPage) qs.set("perPage", String(filters.perPage));

    const suffix = qs.toString();

    return fetch(`/api/media${suffix ? `?${suffix}` : ""}`, {
      cache: "no-store",
    }).then((res) => json<MediaPage>(res));
  },

  get: (id: string) =>
    fetch(`/api/media/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((res) => json<{ data: MediaAsset }>(res))
      .then((body) => body.data),

  /**
   * Upload a file.
   *
   * Goes to whichever provider the institution has switched on, and falls
   * back to the platform's own disk when none is active — so this works on
   * day one, before anybody has configured anything.
   *
   * `XMLHttpRequest` rather than `fetch`, for the one reason it still earns
   * its place: upload progress. A teacher putting up a 400 MB lecture needs
   * to see the bar move, and `fetch` cannot report it.
   */
  upload: (
    file: File,
    options: {
      kind?: MediaKind;
      /** Public is opt-in. The default keeps a file on the platform. */
      isPublic?: boolean;
      onProgress?: (percent: number) => void;
      signal?: AbortSignal;
    } = {},
  ): Promise<MediaAsset> =>
    new Promise((resolve, reject) => {
      const form = new FormData();

      form.append("file", file);
      if (options.kind) form.append("kind", options.kind);
      if (options.isPublic) form.append("public", "1");

      const xhr = new XMLHttpRequest();

      xhr.open("POST", "/api/media");

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && options.onProgress) {
          options.onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };

      xhr.onload = () => {
        let body: { data?: MediaAsset; message?: string } = {};

        try {
          body = JSON.parse(xhr.responseText) as typeof body;
        } catch {
          /* A non-JSON body is a gateway or a body-size limit talking. */
        }

        if (xhr.status >= 200 && xhr.status < 300 && body.data) {
          resolve(body.data);
        } else {
          reject(
            new ApiError(
              body.message ??
                (xhr.status === 413
                  ? "That file is larger than the server will accept."
                  : "That file could not be uploaded."),
              xhr.status,
            ),
          );
        }
      };

      xhr.onerror = () =>
        reject(new ApiError("The upload did not reach the server.", 0));

      xhr.onabort = () => reject(new ApiError("Upload cancelled.", 0));

      options.signal?.addEventListener("abort", () => xhr.abort());

      xhr.send(form);
    }),

  /** Record a link somebody pasted — YouTube, Vimeo, anything. */
  link: (url: string, input: { kind?: MediaKind; name?: string } = {}) =>
    fetch("/api/media/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, ...input }),
    })
      .then((res) => json<{ data: MediaAsset }>(res))
      .then((body) => body.data),

  /**
   * Forget a file.
   *
   * It goes from the provider as well as from the library, so a lesson still
   * pointing at it reports the media as missing rather than playing nothing.
   */
  remove: (id: string) =>
    fetch(`/api/media/${encodeURIComponent(id)}`, { method: "DELETE" }).then(
      async (res) => {
        if (!res.ok) await json(res);
      },
    ),
};

export { ApiError };
