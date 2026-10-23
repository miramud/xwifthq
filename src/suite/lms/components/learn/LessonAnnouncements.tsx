"use client";

import { useCallback, useEffect, useState } from "react";
import { Megaphone, RefreshCw } from "lucide-react";
import {
  getCourseAnnouncements,
  ApiError,
  type LearnerAnnouncement,
} from "@/lib/api/learn-client";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * The learner-facing end of instructor announcements.
 *
 * Instructors have always been able to send these; until now nothing anywhere
 * read them back, so every announcement went into a void. This is the reader.
 */
export default function LessonAnnouncements({ courseSlug }: { courseSlug: string }) {
  const [items, setItems] = useState<LearnerAnnouncement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * Both state writes happen in the promise callbacks, never synchronously in
   * the effect body — a setState during render/effect is a cascading update
   * React has to redo, and the lint rule that catches it is right to.
   */
  const load = useCallback(() => {
    getCourseAnnouncements(courseSlug)
      .then((data) => {
        setItems(data);
        setError(null);
      })
      .catch((err: unknown) =>
        setError(err instanceof ApiError ? err.message : "Couldn't load announcements."),
      );
  }, [courseSlug]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="max-w-3xl rounded-xl border border-neutral-200 p-6 text-center">
        <p className="text-sm text-neutral-600">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </button>
      </div>
    );
  }

  if (items === null) {
    return (
      <div className="max-w-3xl space-y-3" role="status" aria-busy="true">
        <span className="sr-only">Loading announcements</span>
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-24 animate-pulse rounded-xl bg-neutral-100 motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl rounded-xl border border-dashed border-neutral-200 p-10 text-center">
        <Megaphone className="mx-auto mb-3 h-6 w-6 text-neutral-300" aria-hidden="true" />
        <p className="text-sm text-neutral-500">
          No announcements yet. Anything your instructor posts about this course will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="max-w-3xl space-y-3">
      {items.map((item) => (
        <li key={item.id} className="rounded-xl border border-neutral-200 p-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="font-heading text-sm font-semibold text-neutral-800">{item.title}</h4>
            {item.isBroadcast && (
              <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-500">
                All courses
              </span>
            )}
          </div>

          <RichTextView value={item.body} size="sm" className="text-neutral-600" />

          <p className="mt-3 text-xs text-neutral-400">
            {item.instructor ?? "Your instructor"} &middot;{" "}
            <time dateTime={item.sentOn}>
              {new Date(item.sentOn).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </p>
        </li>
      ))}
    </ul>
  );
}
