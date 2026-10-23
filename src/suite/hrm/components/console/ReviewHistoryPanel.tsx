"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardCheck, ClipboardList } from "lucide-react";
import { Button, Chip, Empty, Panel, cx } from "@/components/workspace/kit";
import { hueFor } from "@/components/workspace/modules";
import { IconTile, ToneChip } from "../ui/recordKit";
import { hrm, type PerformanceReview } from "@/lib/api/hrm-client";
import { formatDate } from "@/suite/hrm/lib/format";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * Everything this person has ever been reviewed on.
 *
 * `GET /hrm/employees/{employee}/reviews` had no caller, and the nearest thing
 * that did — the rating chart on the performance screen — answers a narrower
 * question. That chart is **completed reviews only**, and it is two numbers per
 * round. This is the written record: what she said about her own year, what
 * her manager said back, what was agreed, and the rounds that were abandoned
 * rather than finished.
 *
 * Which is the thing somebody opens before a promotion conversation, and the
 * thing that is asked for when a decision is disputed. A rating without the
 * paragraph underneath it is a number nobody can defend.
 *
 * **Ratings are never averaged.** The two travel separately and the gap is
 * reported, because somebody rating themselves 5 against a manager's 2 is the
 * most actionable fact in the whole review and a mean of 3.5 destroys it while
 * looking like information.
 *
 * **Abandoned rounds are shown, greyed.** A review that was cancelled because
 * somebody was on long-term sick is part of why there is a gap in the record,
 * and hiding it makes the gap look like neglect.
 */
export default function ReviewHistoryPanel({
  employeeId,
}: {
  employeeId: string;
}) {
  const [reviews, setReviews] = useState<PerformanceReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    hrm.reviews
      .forEmployee(employeeId)
      .then((result) => {
        if (!cancelled) setReviews(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId]);

  if (error !== null) {
    return (
      <Panel title="Review history" icon={ClipboardCheck} hue="grape">
        <Empty icon={AlertTriangle} hue="coral" title="Could not load" hint={error} />
      </Panel>
    );
  }

  if (reviews === null) {
    return (
      <div
        aria-hidden
        className="ws-card h-40 animate-pulse bg-neutral-50"
      />
    );
  }

  if (reviews.length === 0) {
    return (
      <Panel title="Review history" icon={ClipboardCheck} hue="grape">
        <Empty
          icon={ClipboardList}
          hue="grape"
          title="Never been reviewed here"
          hint="Opening a review round raises one for everybody currently employed."
        />
      </Panel>
    );
  }

  const completed = reviews.filter((r) => r.status === "complete").length;

  return (
    <Panel
      title="Review history"
      icon={ClipboardCheck}
      hue="grape"
      subtitle={
        completed === reviews.length
          ? `${reviews.length} round${reviews.length === 1 ? "" : "s"}`
          : `${completed} of ${reviews.length} round${reviews.length === 1 ? "" : "s"} finished`
      }
      bodyClassName="pt-4"
    >
      <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
        {reviews.map((review) => (
          <ReviewRow
            key={review.id}
            review={review}
            open={expanded === review.id}
            onToggle={() =>
              setExpanded((current) => (current === review.id ? null : review.id))
            }
          />
        ))}
      </ul>
    </Panel>
  );
}

function ReviewRow({
  review,
  open,
  onToggle,
}: {
  review: PerformanceReview;
  open: boolean;
  onToggle: () => void;
}) {
  const abandoned = review.status === "cancelled";

  const written =
    review.selfAssessment !== null ||
    review.managerComments !== null ||
    review.strengths !== null ||
    review.development !== null ||
    review.objectives !== null;

  return (
    <li className={abandoned ? "bg-neutral-50/60" : undefined}>
      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
        <IconTile icon={ClipboardCheck} hue={abandoned ? "slate" : hueFor(review.cycle?.name ?? review.id)} size={36} />
        <div className="min-w-0 flex-1">
          <p
            className={cx("truncate text-sm font-semibold", abandoned ? "text-neutral-500" : "text-neutral-900")}
          >
            {review.cycle?.name ?? "Unnamed round"}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {review.cycle == null
              ? "—"
              : `${formatDate(review.cycle.periodStart)} – ${formatDate(review.cycle.periodEnd)}`}
            {review.completedAt !== null &&
              ` · signed off ${formatDate(review.completedAt)}`}
          </p>
        </div>

        {/*
          Never averaged. Somebody at 5 against a 2 is the most actionable
          thing in the review, and a mean of 3.5 looks like information while
          destroying it.
        */}
        {(review.selfRating !== null || review.managerRating !== null) && (
          <div className="flex shrink-0 items-center gap-3 text-xs">
            <Rating label="Self" value={review.selfRating} />
            <Rating label="Manager" value={review.managerRating} />
          </div>
        )}

        {review.gap !== null && Math.abs(review.gap) >= 2 && (
          <Chip hue="sun">
            {review.gap > 0 ? "+" : ""}
            {review.gap} gap
          </Chip>
        )}

        <ToneChip
          tone={
            review.status === "complete"
              ? "success"
              : abandoned
                ? "neutral"
                : "info"
          }
        >
          {review.statusLabel}
        </ToneChip>

        {written && (
          <Button size="sm" onClick={onToggle} aria-expanded={open} className="shrink-0">
            {open ? "Hide" : "Read it"}
          </Button>
        )}
      </div>

      {open && (
        <div className="mx-5 mb-4 space-y-4 rounded-2xl bg-grape-50/50 px-5 py-4">
          <Passage label="What they said about their own year" text={review.selfAssessment} />
          <Passage label="What their manager said" text={review.managerComments} />
          <Passage label="Strengths" text={review.strengths} />
          <Passage label="Where to develop" text={review.development} />
          <Passage label="Agreed for next time" text={review.objectives} />

          {/*
            The frozen figures. Snapshotted when the review closed rather than
            recomputed, so a target closed next quarter cannot rewrite what was
            discussed in this one.
          */}
          {(review.kpiAttainment !== null ||
            review.milestoneAttainment !== null) && (
            <p className="border-t border-neutral-200 pt-3 text-[11px] text-neutral-500">
              At sign-off:{" "}
              {review.kpiAttainment !== null &&
                `targets ${review.kpiAttainment}%`}
              {review.kpiAttainment !== null &&
                review.milestoneAttainment !== null &&
                " · "}
              {review.milestoneAttainment !== null &&
                `milestones ${review.milestoneAttainment}%`}
              . Frozen at the time, not recalculated since.
            </p>
          )}
        </div>
      )}
    </li>
  );
}

function Rating({ label, value }: { label: string; value: number | null }) {
  return (
    <span className="whitespace-nowrap rounded-lg bg-neutral-100 px-2 py-1 text-neutral-500">
      {label}{" "}
      <span className="font-bold tabular-nums text-neutral-900">
        {value === null ? "—" : value}
      </span>
    </span>
  );
}

function Passage({ label, text }: { label: string; text: string | null }) {
  if (text === null || text.trim() === "") return null;

  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-grape-700">
        {label}
      </h4>
      <RichTextView value={text} size="sm" className="mt-1 text-neutral-700" />
    </div>
  );
}
