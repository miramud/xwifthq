"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ClipboardList, HelpCircle, TriangleAlert } from "lucide-react";
import { CalloutStrip, Chip, Empty, Panel } from "@/components/workspace/kit";
import {
  insights,
  type CourseQuizReport,
  type QuizQuestionStats,
  type QuizStats,
} from "@/lib/api/instructor-client";

/** Below this, a question is doing more harm than teaching. */
const STRUGGLING = 50;

/**
 * Which questions people get wrong, and what they answer instead.
 *
 * A course average tells an author the quiz is hard. This tells them *question
 * four* is hard, and the wrong answers underneath usually tell them why:
 * everybody picking the same distractor is a question with two defensible
 * readings far more often than it is a cohort that did not read the material.
 *
 * Three things the screen refuses to do.
 *
 * **It will not average a blank into a wrong answer.** A question at the end of
 * a long quiz that half the cohort never reached is a pacing problem. Reporting
 * it as a 40% correct rate sends the author off to rewrite a question that was
 * fine.
 *
 * **It will not present a rate off three attempts as a finding.** The count
 * travels with every percentage, and anything thin is said to be thin rather
 * than quietly shown next to figures that mean something.
 *
 * **It will not hide an edited quiz.** Questions live in the lecture's JSON, so
 * removing one orphans its answers. Those attempts happened; "80 attempts, 60
 * answers" with no explanation reads as a bug rather than as an edit.
 */
export default function QuizBreakdown({ courseSlug }: { courseSlug: string }) {
  const [report, setReport] = useState<CourseQuizReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    insights
      .courseQuizzes(courseSlug)
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
      <Panel title="Question breakdown" icon={AlertTriangle} hue="rose">
        <Empty icon={AlertTriangle} hue="rose" title="We could not load the quiz figures" hint={error} />
      </Panel>
    );
  }

  if (report === null) {
    return (
      <div className="h-64 animate-pulse rounded-[1.25rem] bg-neutral-200/60" aria-hidden />
    );
  }

  if (report.quizzes.length === 0) {
    return (
      <Panel title="Question breakdown" icon={ClipboardList} hue="sky">
        <Empty
          icon={ClipboardList}
          hue="sky"
          title="No quizzes in this course"
          hint="Add a quiz lecture. Figures for each question show here once people start answering."
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {report.quizzes.map((quiz) => (
        <Quiz key={quiz.lectureId} quiz={quiz} />
      ))}
    </div>
  );
}

function Quiz({ quiz }: { quiz: QuizStats }) {
  const struggling = quiz.questions.filter(
    (q) => q.isReliable && q.correctRate !== null && q.correctRate < STRUGGLING,
  );

  return (
    <Panel
      title={quiz.title}
      icon={HelpCircle}
      hue="sky"
      subtitle={
        quiz.attempts === 0
          ? "Nobody has taken this yet."
          : `${quiz.attempts} ${quiz.attempts === 1 ? "attempt" : "attempts"} · ${quiz.averagePercentage}% average · ${quiz.passRate}% pass`
      }
      bodyClassName={quiz.attempts === 0 ? "p-5" : "pt-4"}
    >
      {quiz.attempts === 0 ? (
        <p className="text-sm text-neutral-600">
          {quiz.questionCount}{" "}
          {quiz.questionCount === 1 ? "question" : "questions"}, no answers yet.
        </p>
      ) : (
        <>
          {struggling.length > 0 && (
            <CalloutStrip
              icon={TriangleAlert}
              hue="sun"
              className="mx-5 mb-2"
              title={`${struggling.length} ${struggling.length === 1 ? "question is" : "questions are"} getting fewer than half right`}
            >
              Look at the wrong answers before rewriting: a question everybody misses the same way usually has two
              defensible readings rather than a teaching problem behind it.
            </CalloutStrip>
          )}

          <ul className="divide-y divide-neutral-100">
            {quiz.questions.map((question) => (
              <Question key={question.id} question={question} />
            ))}
          </ul>

          {/*
            Said out loud. Otherwise the attempt count and the answer counts
            disagree and the reader assumes the report is broken.
          */}
          {quiz.answersToRemovedQuestions > 0 && (
            <p className="border-t border-neutral-100 px-5 py-3 text-[11px] text-neutral-500">
              {quiz.answersToRemovedQuestions} earlier{" "}
              {quiz.answersToRemovedQuestions === 1 ? "answer" : "answers"} were
              to questions that have since been edited out. Those attempts still
              count towards the average above but have nothing left to be
              reported against.
            </p>
          )}
        </>
      )}
    </Panel>
  );
}

function Question({ question }: { question: QuizQuestionStats }) {
  const rate = question.correctRate;

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-bold text-sky-700 tabular-nums">
          {question.position + 1}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm text-neutral-900">{question.prompt}</p>
          <p className="mt-0.5 text-[11px] text-neutral-500">
            {question.typeLabel} · {question.attempted} answered
            {question.skipped > 0 && ` · ${question.skipped} left it blank`}
          </p>
        </div>

        {rate === null ? (
          <Chip hue="slate">Nobody reached it</Chip>
        ) : (
          <Chip
            hue={
              !question.isReliable
                ? "slate"
                : rate < STRUGGLING
                  ? "sun"
                  : "mint"
            }
          >
            {rate}% right
          </Chip>
        )}
      </div>

      {/*
        A percentage off three attempts is noise. Saying so is cheaper than
        letting somebody rewrite a good question on the strength of it.
      */}
      {rate !== null && !question.isReliable && (
        <p className="ml-10 mt-1.5 text-[11px] text-neutral-500">
          Only {question.attempted} answered so far, too few to read anything
          into.
        </p>
      )}

      {/*
        A question most people skip is usually badly worded, ambiguous, or
        past the point where they ran out of patience. That is a different
        problem from one they attempt and fail.
      */}
      {question.skipRate !== null && question.skipRate >= STRUGGLING && (
        <p className="ml-10 mt-1.5 text-[11px] text-sun-700">
          {question.skipRate}% left this blank. That usually means it is
          unclear or too far into the quiz, rather than too hard.
        </p>
      )}

      {question.commonWrongAnswers.length > 0 && (
        <div className="ml-10 mt-2 space-y-1">
          <p className="text-[11px] font-medium text-neutral-500">
            What they put instead
          </p>
          {question.commonWrongAnswers.map((wrong) => (
            <div key={wrong.value} className="flex items-center gap-2">
              <div className="ws-hatch h-1.5 w-24 shrink-0 overflow-hidden rounded-full">
                <div
                  className="h-full rounded-full bg-coral-500 bg-gradient-to-r from-coral-500 to-coral-400"
                  style={{ width: `${wrong.shareOfWrong}%` }}
                />
              </div>
              <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-700">
                {wrong.label}
              </span>
              <span className="shrink-0 text-[11px] text-neutral-500 tabular-nums">
                {wrong.count} ({wrong.shareOfWrong}% of wrong answers)
              </span>
            </div>
          ))}
        </div>
      )}
    </li>
  );
}
