"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  Check,
  EyeOff,
  Gavel,
  Mail,
  MessageSquare,
  Reply,
  ShieldAlert,
  Star,
  Trash2,
  TriangleAlert,
  UserRound,
} from "lucide-react";
import { Button, ButtonLink, Card, Chip, Empty, PageHeader, Panel } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import {
  BackLink,
  ErrorNote,
  FaceAvatar,
  InfoList,
  InfoRow,
  Skeleton,
  StatusChip,
} from "@/suite/lms/components/ui/ws";
import { useConfirm } from "@/components/workspace/ConfirmDialog";

const STATUS_HUE: Record<string, Hue> = {
  published: "mint",
  pending: "sun",
  flagged: "rose",
  removed: "slate",
};
import {
  reviews as api,
  ApiError,
  type AdminReviewDetail,
} from "@/lib/api/admin-client";

/**
 * One review, and the decision about it.
 *
 * The queue shows enough to triage and not enough to decide: a report count
 * without the reported text, a rating without the instructor's reply, and a
 * display name that is whatever the learner typed in the box. Removing
 * somebody's review is not a decision to take off a list row, and publishing
 * one is a decision about what strangers read about a course.
 *
 * The two facts this page adds are the ones a moderator actually reasons from:
 * **who wrote it** and **whether they took the course**. A one-star review
 * from an account with no enrollment behind it is the clearest signal there
 * is, and nothing in the product surfaced it.
 */
export default function ReviewDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const confirm = useConfirm();

  const [review, setReview] = useState<AdminReviewDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    api
      .get(id)
      .then((data) => {
        if (alive) setReview(data);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setError(
          e instanceof ApiError && e.status === 404
            ? "That review no longer exists."
            : "Couldn't load this review.",
        );
      });

    return () => {
      alive = false;
    };
  }, [id]);

  async function moderate(status: string) {
    setBusy(true);

    try {
      await api.setStatus(id, status);
      setReview(await api.get(id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const who = review?.learner.name ?? review?.student;
    const ok = await confirm({
      title: who ? `Delete ${who}'s review?` : "Delete this review?",
      body: "",
      confirmLabel: "Delete review",
      recoverable: true,
    });
    if (!ok) return;
    setBusy(true);

    try {
      await api.remove(id);
      router.push("/suite/lms/reviews");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
      setBusy(false);
    }
  }

  if (error !== null && review === null) {
    return (
      <Card>
        <Empty
          icon={MessageSquare}
          hue="grape"
          title={error}
          action={
            <ButtonLink href="/suite/lms/reviews" variant="primary">
              Back to reviews
            </ButtonLink>
          }
        />
      </Card>
    );
  }

  if (review === null) {
    return (
      <div className="space-y-4" role="status" aria-busy="true">
        <span className="sr-only">Loading review</span>
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <BackLink href="/suite/lms/reviews" label="Back to reviews" />
        <PageHeader
          eyebrow="Review moderation"
          title={
            <span className="flex flex-wrap items-center gap-3">
              {review.courseTitle ?? "Course"}
              <StatusChip status={review.status} hue={STATUS_HUE[review.status]} />
            </span>
          }
          subtitle={review.instructor !== null ? `Taught by ${review.instructor}` : undefined}
        />
      </div>

      {error !== null && <ErrorNote>{error}</ErrorNote>}

      {/*
        Before the text, not after it. Somebody forms a view in the first
        sentence they read, and whether the author took the course changes
        what that view should be.
      */}
      {!review.fromEnrolledLearner && (
        <div className="flex items-start gap-3 rounded-2xl border border-sun-500/25 bg-sun-50 p-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sun-700">
            <TriangleAlert size={17} aria-hidden />
          </span>
          <div>
            <p className="text-sm font-semibold text-neutral-900">This was not written by an enrolled learner</p>
            <p className="mt-0.5 text-xs text-neutral-600">
              There is no enrollment behind it. That does not make it untrue, but it is the thing worth checking before
              it stays published.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Panel title="The review" icon={MessageSquare} hue="grape">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1" aria-label={`${review.rating} out of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    size={18}
                    aria-hidden
                    className={n <= review.rating ? "fill-sun-400 text-sun-400" : "fill-neutral-200 text-neutral-200"}
                  />
                ))}
              </span>

              {review.reports > 0 && (
                <Chip hue="rose" icon={ShieldAlert}>
                  {review.reports} reported
                </Chip>
              )}
            </div>

            <blockquote className="mt-4 whitespace-pre-line rounded-2xl border-l-[3px] border-grape-500/40 bg-neutral-50 px-5 py-4 text-[15px] leading-relaxed text-neutral-800">
              {review.body}
            </blockquote>

            {review.reply != null && (
              <div className="mt-4 rounded-2xl border border-neutral-200 bg-white p-4">
                <p className="flex items-center gap-2 text-xs font-semibold text-sky-700">
                  <Reply size={14} aria-hidden />
                  The instructor replied
                </p>
                <p className="mt-1.5 whitespace-pre-line text-sm text-neutral-700">{review.reply}</p>
              </div>
            )}
          </Panel>

          <Panel title="Decide" subtitle="Publishing shows it to everybody looking at the course." icon={Gavel} hue="blue">
            <div className="flex flex-wrap gap-2">
              <Button
                variant="primary"
                icon={Check}
                disabled={busy || review.status === "published"}
                onClick={() => void moderate("published")}
              >
                Publish
              </Button>

              <Button icon={EyeOff} disabled={busy || review.status === "flagged"} onClick={() => void moderate("flagged")}>
                Hold it back
              </Button>

              <Button
                variant="ghost"
                icon={Trash2}
                disabled={busy}
                onClick={() => void remove()}
                className="!text-error-700 hover:!bg-error-500/5"
              >
                Remove permanently
              </Button>
            </div>

            {/*
              Said plainly, because the three buttons otherwise look like the same
              kind of act. One of them cannot be undone.
            */}
            <p className="mt-3 text-xs text-neutral-500">
              Holding it back hides it and keeps it, so it can be published later. Removing deletes it. The learner is
              not told either way.
            </p>
          </Panel>
        </div>

        <div className="min-w-0 space-y-6">
          <Panel title="Who wrote it" icon={UserRound} hue="sky">
            <div className="mb-2 flex items-center gap-3">
              <FaceAvatar name={review.learner.name ?? review.student} size={44} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-neutral-900">{review.learner.name ?? review.student}</p>
                <p className="truncate text-xs text-neutral-500">
                  {review.fromEnrolledLearner ? "Enrolled learner" : "No enrolment"}
                </p>
              </div>
            </div>
            <InfoList>
              <InfoRow icon={UserRound} label="Written by" hue="sky">
                {review.learner.name ?? review.student}
              </InfoRow>
              <InfoRow icon={Mail} label="Address" hue="blue">
                {review.learner.email ?? "—"}
              </InfoRow>
              {/*
                Both, because they differ. The display name is whatever the learner
                typed, and a moderator deciding whether this is one person under
                several names needs the account behind it.
              */}
              <InfoRow icon={BadgeCheck} label="Shown as" hue="grape">
                {review.student}
              </InfoRow>
              <InfoRow icon={CalendarDays} label="Written" hue="mint">
                {review.date}
              </InfoRow>
            </InfoList>
          </Panel>
        </div>
      </div>
    </div>
  );
}
