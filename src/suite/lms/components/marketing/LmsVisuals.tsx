import {
  ArrowDown,
  BadgeCheck,
  Check,
  CircleCheck,
  FileText,
  ListChecks,
  MonitorPlay,
  TriangleAlert,
  Trophy,
} from "lucide-react";
import { MockFrame } from "@/components/platform/MockFrame";

/**
 * The four drawn figures on the Elevate LMS product page.
 *
 * Every one of them depicts behaviour that exists in the app: three lecture
 * types, four question types, the inline reason a quiz question would be
 * dropped, a serial that resolves at a public URL, quarter badges and an
 * organisation-scoped board. Nothing here illustrates a feature the product
 * does not have.
 *
 * Teal is the LMS hue and carries the chrome. Gold appears in exactly two
 * places on this page — the step in progress, and the certificate — because
 * gold means the moment of mastery and spending it anywhere else makes both
 * meaningless.
 */

/* ------------------------------------------------------------------ */
/*  1 — The pathway ladder                                             */
/* ------------------------------------------------------------------ */

type RungState = "done" | "now" | "next";

const PATHWAY: { title: string; height: number; state: RungState }[] = [
  { title: "Induction and conduct", height: 34, state: "done" },
  { title: "Health and safety at work", height: 48, state: "done" },
  { title: "Data protection basics", height: 60, state: "done" },
  { title: "Revenue analytics", height: 74, state: "now" },
  { title: "Field data quality", height: 82, state: "next" },
  { title: "Budget monitoring", height: 92, state: "next" },
  { title: "Reporting standards", height: 100, state: "next" },
];

/*
  `bg-accent-500` here is a bar, not a label — nothing is written on it, so the
  gold rule about white text does not arise. The word "In progress" beside it
  is accent-700, which is the only gold value that clears 4.5:1 as text.
*/
const RUNG_FILL: Record<RungState, string> = {
  done: "bg-primary-600",
  now: "bg-accent-500",
  next: "bg-neutral-200",
};

const RUNG_WORD: Record<RungState, string> = {
  done: "Complete",
  now: "In progress",
  next: "Not started",
};

const RUNG_WORD_STYLE: Record<RungState, string> = {
  done: "text-primary-700",
  now: "text-accent-700",
  next: "text-neutral-500",
};

export function PathwayLadderFigure() {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Field Operations pathway
        </p>
        <p className="label-mono text-neutral-500">Illustrative</p>
      </div>
      <p className="label-mono mt-1 text-neutral-500">
        Assigned to the operations team · 7 steps
      </p>

      <div
        className="mt-6 flex h-28 items-end gap-1.5 sm:gap-2.5"
        role="img"
        aria-label="A seven-step pathway rising left to right: three steps complete, the fourth in progress, three ahead"
      >
        {PATHWAY.map((rung) => (
          <div
            key={rung.title}
            className={`flex-1 rounded-t-md rounded-b-sm ${RUNG_FILL[rung.state]}`}
            style={{ height: `${rung.height}%` }}
          />
        ))}
      </div>

      <ol className="mt-6 space-y-2 border-t border-neutral-100 pt-5">
        {PATHWAY.map((rung, index) => (
          <li key={rung.title} className="flex items-center gap-2.5">
            <span className="label-mono tnum w-5 shrink-0 text-neutral-500">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-xs text-neutral-700">
              {rung.title}
            </span>
            <span
              className={`label-mono shrink-0 ${RUNG_WORD_STYLE[rung.state]}`}
            >
              {RUNG_WORD[rung.state]}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2 — The curriculum builder                                         */
/* ------------------------------------------------------------------ */

const LECTURE_GLYPH = {
  Video: MonitorPlay,
  Article: FileText,
  Quiz: ListChecks,
} as const;

type LectureKind = keyof typeof LECTURE_GLYPH;

interface BuilderSection {
  title: string;
  lectures: { kind: LectureKind; title: string; meta: string }[];
  collapsed?: number;
}

const SECTIONS: BuilderSection[] = [
  {
    title: "1 · Getting started",
    lectures: [
      { kind: "Video", title: "Welcome and scope", meta: "4:12" },
      { kind: "Article", title: "How approval works", meta: "3 min read" },
      { kind: "Quiz", title: "Check your understanding", meta: "4 questions" },
    ],
  },
  { title: "2 · The revenue model", lectures: [], collapsed: 4 },
  { title: "3 · Reporting standards", lectures: [], collapsed: 2 },
];

const QUESTION_TYPES = [
  "Multiple choice",
  "Fill the blank",
  "Short answer",
  "Matching",
];

export function CourseBuilderFigure() {
  return (
    <MockFrame label="lms / courses / curriculum" hue="primary">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Revenue analytics — curriculum
        </p>
        <p className="label-mono text-neutral-500">Draft</p>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[1.05fr_1fr]">
        {/* Left — the section tree */}
        <div className="space-y-2">
          {SECTIONS.map((section) => (
            <div
              key={section.title}
              className="rounded-lg border border-neutral-200 bg-white"
            >
              <p className="border-b border-neutral-100 px-2.5 py-2 text-[11px] font-semibold text-neutral-900">
                {section.title}
                {section.collapsed !== undefined && (
                  <span className="label-mono ml-2 text-neutral-500">
                    {section.collapsed} lectures
                  </span>
                )}
              </p>
              {section.lectures.length > 0 && (
                <ul className="divide-y divide-neutral-50">
                  {section.lectures.map((lecture) => {
                    const Glyph = LECTURE_GLYPH[lecture.kind];
                    return (
                      <li
                        key={lecture.title}
                        className="flex items-center gap-2 px-2.5 py-1.5"
                      >
                        <Glyph
                          className="h-3.5 w-3.5 shrink-0 text-primary-600"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-700">
                          {lecture.title}
                        </span>
                        <span className="label-mono shrink-0 text-neutral-500">
                          {lecture.meta}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Right — the lecture being edited */}
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3">
          <p className="label-mono text-neutral-500">Lecture</p>
          <p className="mt-1 text-[11px] font-semibold text-neutral-900">
            Check your understanding
          </p>

          <div className="mt-3 flex gap-1" aria-hidden="true">
            {(Object.keys(LECTURE_GLYPH) as LectureKind[]).map((kind) => (
              <span
                key={kind}
                className={`flex-1 rounded px-1 py-1 text-center text-[9px] font-semibold ${
                  kind === "Quiz"
                    ? "bg-primary-600 text-white"
                    : "bg-white text-neutral-500"
                }`}
              >
                {kind}
              </span>
            ))}
          </div>

          <dl className="mt-3 space-y-1.5">
            <div className="flex items-baseline justify-between gap-2 text-[10px]">
              <dt className="text-neutral-500">Questions</dt>
              <dd className="tnum font-semibold text-neutral-900">4</dd>
            </div>
            <div className="flex items-baseline justify-between gap-2 text-[10px]">
              <dt className="text-neutral-500">Pass mark</dt>
              <dd className="tnum font-semibold text-neutral-900">70%</dd>
            </div>
          </dl>

          <p className="label-mono mt-3 text-neutral-500">Question types</p>
          <ul className="mt-1.5 space-y-1">
            {QUESTION_TYPES.map((type) => (
              <li
                key={type}
                className="flex items-center gap-1.5 text-[10px] text-neutral-600"
              >
                <Check
                  className="h-3 w-3 shrink-0 text-primary-600"
                  aria-hidden="true"
                />
                {type}
              </li>
            ))}
          </ul>

          {/*
            The real editor prints this sentence against the question as the
            author types, which is the detail worth drawing: an unanswerable
            quiz is caught while it is being written rather than by the learner
            who reaches it.
          */}
          <p className="mt-3 flex items-start gap-1.5 rounded border border-warning-500/40 bg-warning-500/10 px-2 py-1.5 text-[10px] leading-snug text-neutral-700">
            <TriangleAlert
              className="mt-px h-3 w-3 shrink-0 text-warning-600"
              aria-hidden="true"
            />
            Q3 — every blank needs at least one accepted answer
          </p>
        </div>
      </div>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  3 — The certificate and its public lookup                          */
/* ------------------------------------------------------------------ */

const VERIFIED_ROWS: { label: string; value: string }[] = [
  { label: "Holder", value: "A. Okafor" },
  { label: "Course", value: "Revenue analytics" },
  { label: "Issued by", value: "Example Ltd" },
  { label: "Issue date", value: "12 March 2026" },
];

export function CertificateFigure() {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
        {/*
          The one solid gold surface on this page. #E6A532 behind white is
          2.15:1 and fails AA badly; behind Ink it is 7.7:1. So gold carries
          Ink here, and nothing on the site carries white on gold anywhere.
        */}
        <div className="flex items-center justify-between gap-3 bg-accent-500 px-5 py-3 text-neutral-900">
          <span className="label-mono">Certificate of completion</span>
          <span className="flex items-center gap-2">
            <span className="label-mono">Illustrative</span>
            <BadgeCheck className="h-5 w-5" aria-hidden="true" />
          </span>
        </div>

        <div className="p-5">
          <p className="label-mono text-neutral-500">Awarded to</p>
          <p className="mt-1 font-heading text-xl font-semibold text-neutral-900">
            A. Okafor
          </p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600">
            for completing{" "}
            <span className="font-semibold text-neutral-900">
              Revenue analytics
            </span>{" "}
            at Example Ltd.
          </p>

          <div className="mt-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-neutral-100 pt-4">
            <span className="label-mono text-neutral-500">Serial</span>
            <span className="tnum font-mono text-sm text-neutral-900">
              TT-2026-AB12CD
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center py-3" aria-hidden="true">
        <span className="h-4 w-px bg-primary-500/30" />
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/10">
          <ArrowDown className="h-4 w-4 text-primary-600" />
        </span>
        <span className="h-4 w-px bg-primary-500/30" />
      </div>

      <MockFrame label="/verify/TT-2026-AB12CD" hue="primary">
        <p className="flex items-center gap-2.5">
          <CircleCheck
            className="h-5 w-5 shrink-0 text-success-600"
            aria-hidden="true"
          />
          <span className="font-heading text-sm font-semibold text-neutral-900">
            Certificate verified
          </span>
        </p>

        <dl className="mt-4 space-y-2">
          {VERIFIED_ROWS.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0 last:pb-0"
            >
              <dt className="text-xs text-neutral-500">{row.label}</dt>
              <dd className="text-xs font-medium text-neutral-900">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <p className="label-mono mt-4 text-neutral-500">
          Public page · no account required
        </p>
      </MockFrame>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4 — Badges and the company board                                  */
/* ------------------------------------------------------------------ */

const BOARD: { rank: number; who: string; finished: number; you?: boolean }[] = [
  { rank: 1, who: "K. A.", finished: 14 },
  { rank: 2, who: "T. O.", finished: 12 },
  { rank: 3, who: "You", finished: 11, you: true },
  { rank: 4, who: "M. E.", finished: 9 },
];

const QUARTERS: { tier: string; earned: boolean }[] = [
  { tier: "25%", earned: true },
  { tier: "50%", earned: true },
  { tier: "75%", earned: true },
  { tier: "100%", earned: false },
];

export function GamificationFigure() {
  return (
    <MockFrame label="lms / achievements" hue="primary">
      <p className="font-heading text-sm font-semibold text-neutral-900">
        Your organisation — courses finished
      </p>

      <ol className="mt-3 space-y-1">
        {BOARD.map((row) => (
          <li
            key={row.rank}
            className={`flex items-center gap-3 rounded-lg px-2.5 py-2 ${
              row.you ? "bg-primary-50 ring-1 ring-primary-500/25" : ""
            }`}
          >
            <span className="label-mono tnum w-5 shrink-0 text-neutral-500">
              {row.rank}
            </span>
            <span
              className={`min-w-0 flex-1 truncate text-xs ${
                row.you
                  ? "font-semibold text-primary-700"
                  : "text-neutral-700"
              }`}
            >
              {row.who}
            </span>
            <span className="tnum shrink-0 text-xs font-semibold text-neutral-900">
              {row.finished}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-3 text-[11px] leading-relaxed text-neutral-500">
        Scoped to your own organisation. Nobody outside it appears here, and
        nobody outside it sees you.
      </p>

      <p className="label-mono mt-5 border-t border-neutral-100 pt-4 text-neutral-500">
        Course badges
      </p>

      {/*
        Gold as a tint rather than a fill: these are achievements, which is
        exactly what gold means here, but accent-500 cannot carry text — so the
        tile is gold at 15% and the label is accent-700.
      */}
      <ul className="mt-2.5 flex flex-wrap gap-2">
        {QUARTERS.map((badge) => (
          <li
            key={badge.tier}
            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold ${
              badge.earned
                ? "bg-accent-500/15 text-accent-700"
                : "border border-dashed border-neutral-300 text-neutral-500"
            }`}
          >
            <Trophy className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="tnum">{badge.tier}</span>
            <span className="sr-only">
              {badge.earned ? " badge earned" : " badge not yet earned"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-neutral-500">
        <BadgeCheck
          className="mt-px h-3.5 w-3.5 shrink-0 text-primary-600"
          aria-hidden="true"
        />
        A badge, once earned, is never taken back.
      </p>
    </MockFrame>
  );
}
