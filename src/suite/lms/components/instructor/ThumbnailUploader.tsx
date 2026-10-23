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
 * The gradient is never discarded — it stays as the fallback that renders
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
      setError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
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
        className={`relative flex h-40 w-full items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br ${value.gradient}`}
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
              className="absolute right-2 top-2 rounded-lg bg-neutral-900/70 p-2 text-white transition-colors hover:bg-error-600 disabled:opacity-50"
            >
              <Trash2 size={15} />
            </button>
          </>
        ) : (
          <p className="px-4 text-center text-xs font-medium text-white/80">
            No cover image. The gradient below is used instead.
          </p>
        )}
      </div>

      {/* upload */}
      <div>
        <label
          className={`flex items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-3 text-sm font-medium text-neutral-600 transition-colors ${
            disabled || uploading
              ? "cursor-not-allowed opacity-60"
              : "cursor-pointer hover:border-primary-300 hover:bg-primary-50/40 hover:text-primary-700"
          }`}
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
          {uploading
            ? `Uploading… ${progress}%`
            : value.thumbnailUrl
              ? "Replace cover image"
              : "Upload a cover image"}
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/avif"
            className="hidden"
            disabled={disabled || uploading}
            onChange={handleFile}
          />
        </label>

        {uploading && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-primary-500 transition-[width] duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="Cancel upload"
              className="rounded-md p-1 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <p className="mt-1 text-xs text-neutral-400">PNG, JPG, WebP or AVIF, up to 10 MB. 16:9 works best.</p>
      </div>

      {error && (
        <p className="flex items-center gap-1.5 text-xs text-error-600">
          <AlertCircle size={13} className="shrink-0" />
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
              className={`h-9 w-14 rounded-lg bg-gradient-to-br ${swatch} transition-all disabled:opacity-50 ${
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
