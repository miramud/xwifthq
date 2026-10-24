"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Clock, Film, Timer, TriangleAlert } from "lucide-react";
import { CalloutStrip, Chip, Empty, Panel } from "@/components/workspace/kit";
import {
  insights,
  type CourseEngagement,
  type VideoRetention,
} from "@/lib/api/instructor-client";

/** Below this, a retention curve is noise rather than a finding. */
const RELIABLE = 5;

/**
 * Where people stop, and how long the course really takes.
 *
 * Completion rates say how many finished. When that number disappoints
 * somebody, the two questions they actually have (which lesson loses them,
 * and how long is this really) had no answer anywhere in the product.
 *
 * The retention bars are the point of the screen, and they are a *curve*
 * rather than an average because "62% watched" is the same figure whether
 * everybody drifts off two thirds through or half watch it all and half never
 * start. Those are opposite problems with opposite fixes.
 *
 * What an author does with this is re-record a passage, so the headline for
 * each video is the stretch that loses the most people rather than a score.
 */
export default function EngagementBoard({ courseSlug }: { courseSlug: string }) {
  const [report, setReport] = useState<CourseEngagement | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    insights
      .courseEngagement(courseSlug)
      .then((result) => {
        if (!cancelled) setReport(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [courseSlug]);

  if (error !== null) {
    return (
      <Panel title="Engagement" icon={AlertTriangle} hue="rose">
        <Empty icon={AlertTriangle} hue="rose" title="We could not load engagement" hint={error} />
      </Panel>
    );
  }

  if (report === null) {
    return (
      <div className="h-64 animate-pulse rounded-[1.25rem] bg-neutral-200/60" aria-hidden />
    );
  }

  const timing = report.timeToComplete;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* ------------------------- how long ------------------------- */}

      <Panel
        title="How long it takes"
        icon={Timer}
        hue="sky"
        subtitle={
          timing.finishers === 0
            ? "Nobody has finished this course yet."
            : `${timing.finishers} ${timing.finishers === 1 ? "person has" : "people have"} finished · ${timing.stillGoing} still going`
        }
      >
        {timing.finishers === 0 ? (
          <p className="flex items-center gap-2 text-sm text-neutral-600">
            <Clock size={15} className="shrink-0 text-neutral-400" aria-hidden />
            {timing.stillGoing} {timing.stillGoing === 1 ? "learner is" : "learners are"}{" "}
            part-way through. There is nothing to time until somebody finishes.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-2 rounded-2xl bg-sky-50/70 px-4 py-3">
              <span className="text-[28px] font-bold tracking-tight text-neutral-900 tabular-nums">
                {timing.medianDays}
              </span>
              <span className="text-sm text-neutral-600">
                {timing.medianDays === 1 ? "day" : "days"}, typically
              </span>
              {/*
                The median, and said to be. One learner who took eleven months
                would drag a mean somewhere that describes nobody, and an
                author setting a deadline off it would set the wrong one.
              */}
              <span className="text-xs text-neutral-500">
                median · fastest {timing.fastestDays}d · slowest{" "}
                {timing.slowestDays}d
              </span>
            </div>

            <ul className="mt-4 space-y-2">
              {timing.bands.map((band) => (
                <li key={band.label} className="flex items-center gap-3">
                  <span className="w-28 shrink-0 text-xs text-neutral-600 sm:w-36">
                    {band.label}
                  </span>
                  <div className="ws-hatch h-2.5 flex-1 overflow-hidden rounded-full">
                    <div
                      className="h-full rounded-full bg-sky-500 bg-gradient-to-r from-sky-500 to-sky-400"
                      style={{
                        width: `${timing.finishers > 0 ? (band.learners / timing.finishers) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-8 shrink-0 text-right text-xs text-neutral-500 tabular-nums">
                    {band.learners}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {/* ------------------------- the videos ----------------------- */}

      {report.videos.length === 0 ? (
        <Panel title="Where people stop" icon={Film} hue="grape">
          <Empty
            icon={Film}
            hue="grape"
            title="No videos in this course"
            hint="We measure retention on video lessons only."
          />
        </Panel>
      ) : (
        report.videos.map((video) => <Video key={video.lectureId} video={video} />)
      )}
    </div>
  );
}

function Video({ video }: { video: VideoRetention }) {
  /*
    Unmeasurable is said rather than shown as zero. A YouTube embed plays in a
    cross-origin iframe the page cannot observe, so nought here would be a
    statement about the player rather than about the video, and an author
    would go and re-record something that was fine.
  */
  if (!video.measurable) {
    return (
      <Panel title={video.title} icon={Film} hue="slate">
        <p className="flex items-start gap-2 text-sm text-neutral-600">
          <Film size={15} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
          This video is embedded from YouTube or Vimeo, which plays in a frame we
          cannot measure. Upload the file to the media library to see where
          people stop.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title={video.title}
      icon={Film}
      hue="grape"
      subtitle={
        video.viewers === 0
          ? "Nobody has watched this yet."
          : `${video.viewers} ${video.viewers === 1 ? "viewer" : "viewers"} · ${video.watchedToEnd} watched to the end`
      }
      actions={
        video.medianPercent !== null ? (
          <Chip
            hue={
              !video.isReliable
                ? "slate"
                : video.medianPercent < 50
                  ? "sun"
                  : "mint"
            }
          >
            {video.medianPercent}% typically
          </Chip>
        ) : undefined
      }
    >
      {video.viewers === 0 ? (
        <p className="text-sm text-neutral-500">
          Retention shows here once somebody watches it.
        </p>
      ) : (
        <>
          {/*
            The headline, because it points at a passage rather than a score.
            "Most people stop between 30% and 40%" is something an author can
            go and watch back.
          */}
          {video.biggestDrop !== null && video.isReliable && (
            <CalloutStrip
              icon={TriangleAlert}
              hue="sun"
              className="mb-4"
              title={
                <>
                  Most people stop between {video.biggestDrop.fromPercent}% and {video.biggestDrop.toPercent}%
                </>
              }
            >
              {video.biggestDrop.lost} {video.biggestDrop.lost === 1 ? "viewer leaves" : "viewers leave"} there.
              Watch that stretch back.
            </CalloutStrip>
          )}

          {video.viewers < RELIABLE && (
            <p className="mb-3 text-[11px] text-neutral-500">
              Only {video.viewers} {video.viewers === 1 ? "person has" : "people have"}{" "}
              watched this, which is too few to read a shape into.
            </p>
          )}

          <ul className="space-y-1.5">
            {video.retention.map((point) => (
              <li key={point.atPercent} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-[11px] text-neutral-500 tabular-nums">
                  {point.atPercent}%
                </span>
                <div className="ws-hatch h-2.5 flex-1 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full bg-grape-500 bg-gradient-to-r from-grape-500 to-grape-400"
                    style={{ width: `${point.share}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-[11px] text-neutral-500 tabular-nums">
                  {point.viewers} ({point.share}%)
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
