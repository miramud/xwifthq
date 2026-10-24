"use client";

import { useEffect, useState } from "react";
import { Star, Check } from "lucide-react";
import { saveReview, getMyReviews, ApiError } from "@/lib/api/learn-client";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";

/**
 * Where a learner actually writes a review.
 *
 * Reviews were previously seed-only: the moderation queue, the instructor
 * reply thread and the rating on every course card all existed, with no way for
 * anyone to submit one. This is the missing end of that feature.
 *
 * Only rendered for someone holding a live enrollment, the API enforces the
 * same rule, so this is presentation, not the guard.
 */
export default function ReviewForm({
  courseSlug,
  onSaved,
}: {
  courseSlug: string;
  onSaved?: () => void;
}) {
  const { user } = useAuth();
  const { isEnrolled } = useStore();

  // Presentation gate only, the API refuses a review from anyone without a
  // live enrollment regardless of what gets rendered here. Any member learns
  // (there is no "student" role any more), so enrolment is the whole test;
  // the platform's own people are not learners.
  const mayReview =
    Boolean(user) && user?.role !== "super_admin" && user?.role !== "platform_staff" && isEnrolled(courseSlug);

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isEdit, setIsEdit] = useState(false);

  // Load an existing review so posting again reads as editing, not duplicating.
  useEffect(() => {
    let alive = true;

    getMyReviews()
      .then((reviews) => {
        const mine = reviews.find((r) => r.courseSlug === courseSlug);
        if (!alive || !mine) return;
        setRating(mine.rating);
        setComment(mine.body);
        setIsEdit(true);
      })
      .catch(() => {
        /* not signed in, or not enrolled, the form simply starts empty */
      });

    return () => {
      alive = false;
    };
  }, [courseSlug]);

  const tooShort = comment.trim().length < 10;
  const canSubmit = rating > 0 && !tooShort && status !== "saving";

  if (!mayReview) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;

    setStatus("saving");
    setError(null);

    try {
      await saveReview(courseSlug, { rating, comment: comment.trim() });
      setStatus("saved");
      setIsEdit(true);
      onSaved?.();
    } catch (err) {
      setStatus("idle");
      setError(
        err instanceof ApiError ? err.message : "Could not save your review. Try again.",
      );
    }
  }

  const shown = hovered || rating;

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-neutral-200 p-6">
      <h3 className="font-heading text-lg font-semibold text-neutral-800">
        {isEdit ? "Update your review" : "Write a review"}
      </h3>
      <p className="mt-1 text-sm text-neutral-500">
        Only learners enrolled on this course can review it.
      </p>

      {/* Rating. Radio inputs rather than buttons, so it is one keyboard stop
          with arrow-key selection and announces as a group. */}
      <fieldset className="mt-5">
        <legend className="mb-2 text-sm font-medium text-neutral-700">
          Your rating <span className="text-error-500">*</span>
        </legend>

        <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((value) => (
            <label
              key={value}
              onMouseEnter={() => setHovered(value)}
              className="cursor-pointer p-1 focus-within:ring-2 focus-within:ring-primary-500 focus-within:ring-offset-1 rounded"
            >
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
              />
              <Star
                className={`h-7 w-7 transition-colors ${
                  value <= shown ? "fill-warning-400 text-warning-400" : "text-neutral-300"
                }`}
                aria-hidden="true"
              />
              <span className="sr-only">
                {value} star{value === 1 ? "" : "s"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-5">
        <label htmlFor="review-comment" className="mb-2 block text-sm font-medium text-neutral-700">
          What should other learners know? <span className="text-error-500">*</span>
        </label>
        <textarea
          id="review-comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          maxLength={2000}
          aria-describedby="review-comment-help"
          className="w-full resize-y rounded-xl border border-neutral-200 p-3 text-sm text-neutral-700 transition-colors placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          placeholder="What worked, what didn't, and who this course is for."
        />
        {/* Persistent helper rather than a placeholder-only hint, and it states
            the requirement up front instead of only after a failed submit. */}
        <p id="review-comment-help" className="mt-1.5 text-xs text-neutral-400">
          At least 10 characters. {comment.trim().length}/2000
        </p>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-600">
          {error}
        </p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <button type="submit" disabled={!canSubmit} className="btn-primary disabled:opacity-50">
          {status === "saving" ? "Saving…" : isEdit ? "Update review" : "Publish review"}
        </button>

        {status === "saved" && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-success-600">
            <Check className="h-4 w-4" aria-hidden="true" />
            Saved
          </p>
        )}
      </div>
    </form>
  );
}
