"use client";

import { useEffect, useMemo, useRef } from "react";
import { Film } from "lucide-react";
import { reportVideoProgress } from "@/lib/api/learn-client";

/**
 * Plays the lecture's real video.
 *
 * Uploaded files (Cloudinary, S3, local disk) stream through a native <video>
 * element, which gives us a real `ended` event to mark the lesson complete.
 * Pasted YouTube/Vimeo links are embedded in an iframe — cross-origin, so we
 * cannot observe playback there and the learner marks the lesson complete
 * themselves with the button below the player.
 */
export default function LessonVideo({
  url,
  title,
  gradient,
  courseSlug,
  lectureId,
  onComplete,
}: {
  url: string;
  title: string;
  gradient: string;
  /** Both optional: without them the player simply reports nothing. */
  courseSlug?: string;
  lectureId?: string;
  onComplete: () => void;
}) {
  const embed = useMemo(() => toEmbedUrl(url), [url]);
  const fired = useRef(false);
  const lastReported = useRef(0);

  // A new lecture re-arms the completion callback and the reporting throttle.
  useEffect(() => {
    fired.current = false;
    lastReported.current = 0;
  }, [url]);

  if (!url) {
    return (
      <Placeholder gradient={gradient}>
        <Film className="mb-3 h-8 w-8 text-white/70" />
        <p className="text-sm font-medium text-white/90">No video has been added to this lesson yet.</p>
      </Placeholder>
    );
  }

  if (embed) {
    return (
      <div className="overflow-hidden rounded-xl bg-black">
        <div className="relative aspect-video">
          <iframe
            src={embed}
            title={title}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-black">
      <video
        key={url}
        src={url}
        title={title}
        controls
        controlsList="nodownload"
        preload="metadata"
        className="aspect-video w-full"
        onEnded={() => {
          if (!fired.current) {
            fired.current = true;
            onComplete();
          }
        }}
        // Some browsers never fire `ended` on a seek to the very end.
        onTimeUpdate={(e) => {
          const el = e.currentTarget;

          if (!fired.current && el.duration > 0 && el.currentTime / el.duration >= 0.97) {
            fired.current = true;
            onComplete();
          }

          /*
            Throttled hard. `onTimeUpdate` fires several times a second, and a
            retention curve is not improved by knowing somebody's position to
            the quarter second — it is drawn in tenths.

            Only forward, too: the server keeps the furthest point, but sending
            a rewind would be asking it to ignore something we should not have
            said. Somebody rewatching a hard passage has not stopped there.
          */
          if (
            courseSlug !== undefined &&
            lectureId !== undefined &&
            el.duration > 0 &&
            el.currentTime > lastReported.current + 15
          ) {
            lastReported.current = el.currentTime;
            reportVideoProgress(courseSlug, lectureId, el.currentTime, el.duration);
          }
        }}
      >
        Your browser cannot play this video.{" "}
        <a href={url} className="underline">
          Download it instead.
        </a>
      </video>
    </div>
  );
}

function Placeholder({
  gradient,
  children,
}: {
  gradient: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex aspect-video flex-col items-center justify-center rounded-xl bg-gradient-to-br ${gradient}`}
    >
      {children}
    </div>
  );
}

/**
 * YouTube and Vimeo watch URLs must be rewritten to their embed form; anything
 * else is treated as a direct media URL and returns null.
 */
export function toEmbedUrl(raw: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  const host = parsed.hostname.replace(/^www\./, "");

  if (host === "youtu.be") {
    const id = parsed.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (parsed.pathname.startsWith("/embed/") || parsed.pathname.startsWith("/shorts/")) {
      const id = parsed.pathname.split("/")[2];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
  }

  if (host === "vimeo.com") {
    const id = parsed.pathname.split("/").filter(Boolean)[0];
    return id && /^\d+$/.test(id) ? `https://player.vimeo.com/video/${id}` : null;
  }

  if (host === "player.vimeo.com") return raw;

  return null;
}

/**
 * True when playback happens inside a cross-origin iframe, so the page cannot
 * detect that the lesson finished and must rely on "Mark as complete".
 */
export function isEmbeddedProvider(url: string): boolean {
  return toEmbedUrl(url) !== null;
}
