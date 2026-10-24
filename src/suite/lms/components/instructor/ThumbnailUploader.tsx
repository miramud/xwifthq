"use client";

import { useRef, useState } from "react";
import { AlertCircle, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { uploadMedia, ApiError } from "@/lib/api/upload-client";

const SWATCHES = [
  "from-primary-400 to-primary-600",
  "from-info-500 to-info-700",
  "from-accent-500 to-accent-700",
  "from-success-500 to-success-700",
  "from-pink-500 to-pink-700",
  "from-teal-500 to-teal-700",
] as const;

export interface ThumbnailValue {
  gradient: string;
  thumbnailUrl: string | null;
  thumbnailPublicId: string | null;
}

/**
 * Course cover art: upload a real image, or pick a gradient.
 *
 * The gradient is never discarded: it stays as the fallback that renders
 * wherever the image has not loaded, and it is what the course shows if the
 * author later removes the image.
 */
export default function ThumbnailUploader({
  value,
  onChange,
  disabled = false,
}: {
  value: ThumbnailValue;
  onChange: (next: ThumbnailValue) => void;
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    setError(null);
    setProgress(0);
    setUploading(true);
    abortRef.current = new AbortController();

    try {
      const result = await uploadMedia(file, "image", setProgress, abortRef.current.signal);
      onChange({ ...value, thumbnailUrl: result.url, thumbnailPublicId: result.publicId });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The upload didn't finish. Try again.");
    } finally {
      setUploading(false);
      abortRef.current = null;
      input.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {/* preview */}
      <div
        className={`relative flex h-40 w-full items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br ${value.gradient}`}
      >
        {value.thumbnailUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- remote Cloudinary host */}
            <img src={value.thumbnailUrl} alt="Course cover" className="h-full w-full object-cover" />
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => onChange({ ...value, thumbnailUrl: null, thumbnailPublicId: null })}
              aria-label="Remove cover image"
              className="absolute right-2 top-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl bg-neutral-900/70 text-white outline-none transition-colors hover:bg-error-600 focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
            >
              <Trash2 size={15} aria-hidden />
            </button>
          </>
        ) : (
          <p className="px-4 text-center text-xs font-medium text-white/80">
            No cover image yet, so the gradient below shows instead.
          </p>
        )}
      </div>

      {/* upload */}
      <div>
        <label
          className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-primary-200 bg-primary-50/30 px-4 py-3 text-sm font-semibold text-primary-700 transition-colors focus-within:ring-2 focus-within:ring-primary-300 ${
            disabled || uploading
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-primary-300 hover:bg-primary-50"
          }`}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <ImagePlus size={16} aria-hidden />}
          {uploading
            ? `Uploading… ${progress}%`
            : value.thumbnailUrl
              ? "Replace cover image"
              : "Upload a cover image"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="sr-only"
            disabled={disabled || uploading}
            onChange={handleFile}
          />
        </label>

        {uploading && (
          <div className="mt-2 flex items-center gap-2">
            <div className="ws-hatch h-1.5 flex-1 overflow-hidden rounded-full">
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Cancel upload"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-neutral-500 outline-none transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <X size={14} aria-hidden />
            </button>
          </div>
        )}

        <p className="mt-1.5 text-xs text-neutral-500">PNG, JPG, WebP or AVIF, up to 10 MB. 16:9 works best.</p>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-error-700">
          <AlertCircle size={13} className="shrink-0" aria-hidden />
          {error}
        </p>
      )}

      {/* gradient fallback */}
      <div>
        <p className="mb-1.5 text-xs font-medium text-neutral-600">
          Fallback gradient{value.thumbnailUrl ? " (shown while the image loads)" : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {SWATCHES.map((swatch) => (
            <button
              key={swatch}
              type="button"
              disabled={disabled}
              onClick={() => onChange({ ...value, gradient: swatch })}
              aria-label={`Use the ${swatch.replace(/from-|to-/g, "").replace(/-/g, " ")} gradient`}
              aria-pressed={value.gradient === swatch}
              className={`h-11 w-14 cursor-pointer rounded-xl bg-gradient-to-br ${swatch} outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary-300 disabled:opacity-50 motion-reduce:transition-none ${
                value.gradient === swatch
                  ? "ring-2 ring-primary-500 ring-offset-2"
                  : "hover:scale-105"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export { SWATCHES };
