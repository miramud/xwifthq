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
   * the effect body, a setState during render/effect is a cascading update
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
      <div className="max-w-3xl rounded-[1.25rem] border border-neutral-200/70 bg-white p-6 text-center">
        <p className="text-sm text-neutral-600">{error}</p>
        <button
          type="button"
          onClick={load}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-primary-700 hover:bg-primary-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-300"
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
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
            className="h-24 animate-pulse rounded-2xl bg-neutral-200/60 motion-reduce:animate-none"
          />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-3xl rounded-[1.25rem] border border-dashed border-neutral-200 bg-neutral-50/60 p-10 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
          <Megaphone className="h-5 w-5" aria-hidden="true" />
        </span>
        <p className="text-sm text-neutral-500">
          No announcements yet. Anything your instructor posts about this course appears here.
        </p>
      </div>
    );
  }

  return (
    <ul className="max-w-3xl space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 rounded-[1.25rem] border border-neutral-200/70 bg-white p-5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral-50 text-coral-700" aria-hidden="true">
            <Megaphone size={18} />
          </span>
          <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h4 className="font-heading text-sm font-bold text-neutral-900">{item.title}</h4>
            {item.isBroadcast && (
              <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                All courses
              </span>
            )}
          </div>

          <RichTextView value={item.body} size="sm" className="text-neutral-600" />

          <p className="mt-3 text-xs text-neutral-500">
            {item.instructor ?? "Your instructor"} &middot;{" "}
            <time dateTime={item.sentOn}>
              {new Date(item.sentOn).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>
          </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
