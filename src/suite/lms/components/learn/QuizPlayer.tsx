"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HelpCircle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  gradeQuiz,
  startQuiz,
  ApiError,
  type LearnerQuestion,
  type QuizAnswer,
  type QuizResult,
  type QuizSitting,
} from "@/lib/api/learn-client";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";

/**
 * Plays a real, authored quiz: multiple choice, fill in the blank, short answer
 * and matching.
 *
 * Grading happens on the server — this component never receives the answer key,
 * so the quiz cannot be beaten by reading the page source.
 *
 * A quiz that rations something — a clock, a number of tries, a bank that asks
 * ten of forty — has to be *opened* before it can be answered, and the
 * questions arrive from that call rather than with the course. So this waits
 * on a sitting before showing anything, which is also what stops a refresh
 * being a way to reroll the bank or restart the timer: the server hands back
 * the sitting already in progress.
 *
 * The clock here counts down and submits when it reaches zero. That is a
 * courtesy, not the rule — the server checks the time on the way in, and
 * closing the laptop does not stop it.
 */
export default function QuizPlayer({
  courseSlug,
  lectureId,
  title,
  onComplete,
}: {
  courseSlug: string;
  lectureId: string;
  title: string;
  onComplete: () => void;
}) {
  const [sitting, setSitting] = useState<QuizSitting | null>(null);
  const [answers, setAnswers] = useState<Record<string, QuizAnswer>>({});
  const [result, setResult] = useState<QuizResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  /*
    The sitting is the source of the questions. For a plain quiz the server
    hands back the same list the course payload already carried, so this costs
    one round trip and keeps a single path through the component.
  */
  useEffect(() => {
    let alive = true;

    setSitting(null);
    setAnswers({});
    setResult(null);
    setError(null);

    startQuiz(courseSlug, lectureId)
      .then((opened) => {
        if (alive) setSitting(opened);
      })
      .catch((e: unknown) => {
        if (alive) {
          setError(
            e instanceof ApiError ? e.message : "Could not open this quiz.",
          );
        }
      });

    return () => {
      alive = false;
    };
  }, [courseSlug, lectureId, attempt]);

  const questions = sitting?.questions ?? [];
  const expiresAt = sitting?.expiresAt ?? null;

  const verdict = useMemo(
    () => new Map((result?.results ?? []).map((r) => [r.id, r])),
    [result],
  );

  const answered = questions.filter((q) => isAnswered(q, answers[q.id])).length;
  const allAnswered = questions.length > 0 && answered === questions.length;

  const submit = useCallback(async () => {
    setSubmitting(true);
    setError(null);

    try {
      const graded = await gradeQuiz(
        courseSlug,
        lectureId,
        answers,
        sitting?.sessionId,
      );

      setResult(graded);
      onComplete();
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Could not submit your answers.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [answers, courseSlug, lectureId, onComplete, sitting?.sessionId]);

  /*
    The countdown. It submits whatever is answered when it reaches zero rather
    than discarding the sitting: somebody who ran out of time on the last
    question should still be marked on the nine they did.
  */
  useEffect(() => {
    if (expiresAt === null || result !== null) return;

    const deadline = new Date(expiresAt).getTime();

    const tick = () => {
      const left = deadline - Date.now();
      setRemainingMs(left);

      if (left <= 0) {
        void submit();
      }
    };

    tick();
    const timer = window.setInterval(tick, 1000);

    return () => window.clearInterval(timer);
  }, [expiresAt, result, submit]);

  async function handleSubmit() {
    await submit();
  }

  if (sitting === null && error !== null) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-neutral-200 p-10 text-center">
        <AlertCircle className="mx-auto mb-3 h-6 w-6 text-warning-500" />
        <p className="text-sm text-neutral-600">{error}</p>
      </div>
    );
  }

  if (sitting === null) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-neutral-200 p-10 text-center">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-neutral-300" />
        <p className="text-sm text-neutral-500">Opening the quiz…</p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-neutral-200 p-10 text-center">
        <HelpCircle className="mx-auto mb-3 h-6 w-6 text-neutral-300" />
        <p className="text-sm text-neutral-500">
          Your instructor hasn&apos;t added any questions to this quiz yet.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
          <HelpCircle className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-neutral-800">Quiz: {title}</h2>
          <p className="text-sm text-neutral-500">
            {questions.length} question{questions.length === 1 ? "" : "s"} · pass mark{" "}
            {sitting.passMark}%
            {/*
              Said before they start, not discovered by running out. Sitting a
              quiz fairly means knowing what it costs.
            */}
            {sitting.remaining !== null && !sitting.passed && (
              <>
                {" · "}
                {sitting.remaining} {sitting.remaining === 1 ? "try" : "tries"} left
              </>
            )}
          </p>
        </div>

        {remainingMs !== null && result === null && (
          <span
            className={`ml-auto rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums ${
              remainingMs < 60_000
                ? "bg-error-50 text-error-700"
                : "bg-neutral-100 text-neutral-700"
            }`}
            // Announced politely rather than on every tick, so a screen reader
            // is not read a clock once a second for twenty minutes.
            aria-live="polite"
            aria-atomic="true"
          >
            {formatClock(remainingMs)}
          </span>
        )}
      </div>

      {result && (
        <ScoreBanner
          result={result}
          /*
            Null when there is nothing left to retry with. Offering the button
            and then refusing the attempt is worse than not offering it.
          */
          onRetry={
            result.mayAttempt === false
              ? null
              : () => setAttempt((n) => n + 1)
          }
        />
      )}

      <div className="space-y-6">
        {questions.map((q, index) => (
          <QuestionBlock
            key={q.id}
            index={index}
            question={q}
            answer={answers[q.id]}
            onAnswer={(a) => setAnswers((prev) => ({ ...prev, [q.id]: a }))}
            verdict={verdict.get(q.id)}
            locked={result !== null}
          />
        ))}
      </div>

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </p>
      )}

      {!result && (
        <div className="mt-6 flex items-center gap-4">
          <button
            onClick={handleSubmit}
            disabled={!allAnswered || submitting}
            className={`inline-flex items-center gap-2 rounded-lg px-8 py-3 text-sm font-semibold transition-all duration-200 ${
              allAnswered && !submitting
                ? "bg-primary-600 text-white hover:bg-primary-700 active:scale-[0.98]"
                : "cursor-not-allowed bg-neutral-200 text-neutral-400"
            }`}
          >
            {submitting && <Loader2 size={15} className="animate-spin" />}
            {submitting ? "Submitting…" : "Submit Quiz"}
          </button>
          <span className="text-xs text-neutral-400">
            {answered} of {questions.length} answered
          </span>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ScoreBanner({
  result,
  onRetry,
}: {
  result: QuizResult;
  /** Null when there are no attempts left — the button is not shown at all. */
  onRetry: (() => void) | null;
}) {
  return (
    <div
      className={`mb-6 rounded-xl border p-4 ${
        result.passed
          ? "border-success-500/30 bg-success-500/10"
          : "border-accent-500/30 bg-accent-500/10"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`font-semibold ${result.passed ? "text-success-600" : "text-accent-600"}`}>
            {result.passed ? "Passed" : "Not quite yet"}
          </p>
          <p className="mt-0.5 text-sm text-neutral-600">
            You scored {result.score} of {result.maxScore} points ({result.percentage}%) —{" "}
            {result.correctCount} of {result.total} questions correct.
          </p>
        </div>
        {onRetry === null ? (
          /*
            Said rather than shown as a dead button. Somebody who has used
            their last attempt needs to know that is what happened.
          */
          <span className="shrink-0 text-sm text-neutral-500">
            No attempts left
          </span>
        ) : (
          <button
            onClick={onRetry}
            className="flex shrink-0 items-center gap-1.5 text-sm text-neutral-600 transition-colors hover:text-neutral-800"
          >
            <RotateCcw className="h-4 w-4" /> Retry
            {result.remaining != null && ` (${result.remaining} left)`}
          </button>
        )}
      </div>
    </div>
  );
}

interface Verdict {
  correct: boolean;
  explanation: string | null;
  correctAnswer: unknown;
}

function QuestionBlock({
  index,
  question,
  answer,
  onAnswer,
  verdict,
  locked,
}: {
  index: number;
  question: LearnerQuestion;
  answer: QuizAnswer | undefined;
  onAnswer: (a: QuizAnswer) => void;
  verdict?: Verdict;
  locked: boolean;
}) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="font-medium text-neutral-800">
          <span className="mr-1.5 font-semibold text-primary-600">{index + 1}.</span>
          {renderPrompt(question)}
        </p>
        {verdict &&
          (verdict.correct ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success-500" />
          ) : (
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-error-500" />
          ))}
      </div>

      {question.type === "multiple_choice" && (
        <MultipleChoice
          question={question}
          answer={answer}
          onAnswer={onAnswer}
          locked={locked}
          verdict={verdict}
        />
      )}
      {question.type === "fill_blank" && (
        <FillBlank question={question} answer={answer} onAnswer={onAnswer} locked={locked} />
      )}
      {question.type === "short_answer" && (
        <ShortAnswer answer={answer} onAnswer={onAnswer} locked={locked} />
      )}
      {question.type === "matching" && (
        <Matching question={question} answer={answer} onAnswer={onAnswer} locked={locked} />
      )}

      {verdict && !verdict.correct && (
        <p className="mt-3 rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          <span className="font-semibold text-neutral-700">Correct answer: </span>
          {formatCorrectAnswer(question, verdict.correctAnswer)}
        </p>
      )}
      {verdict?.explanation && (
        <p className="mt-2 text-xs leading-relaxed text-neutral-500">{verdict.explanation}</p>
      )}
    </div>
  );
}

/** Fill-in-the-blank prompts show their blanks as numbered slots. */
function renderPrompt(question: LearnerQuestion): string {
  if (question.type !== "fill_blank") return question.prompt;
  let n = 0;
  return question.prompt.replace(/_{3,}/g, () => `[${++n}]`);
}

/* ---------- per-type inputs ---------- */

function MultipleChoice({
  question,
  answer,
  onAnswer,
  locked,
  verdict,
}: {
  question: LearnerQuestion;
  answer: QuizAnswer | undefined;
  onAnswer: (a: QuizAnswer) => void;
  locked: boolean;
  verdict?: Verdict;
}) {
  const selected = answer && "choice" in answer ? answer.choice : null;
  const correctIndex = typeof verdict?.correctAnswer === "number" ? verdict.correctAnswer : null;

  return (
    <div className="space-y-2.5">
      {(question.options ?? []).map((opt, oi) => {
        const isSelected = selected === oi;
        const isCorrect = correctIndex === oi;

        let style = "border-neutral-200 hover:border-primary-300 hover:bg-primary-50/50";
        if (locked) {
          if (isCorrect) style = "border-success-400 bg-success-50";
          else if (isSelected) style = "border-error-400 bg-error-50";
          else style = "border-neutral-200 opacity-60";
        } else if (isSelected) {
          style = "border-primary-500 bg-primary-50 ring-1 ring-primary-500/30";
        }

        return (
          <button
            key={oi}
            onClick={() => !locked && onAnswer({ choice: oi })}
            disabled={locked}
            className={`flex w-full items-center gap-3 rounded-lg border p-3.5 text-left transition-all duration-150 ${style} ${
              locked ? "cursor-default" : "cursor-pointer"
            }`}
          >
            <span className="shrink-0">
              {locked && isCorrect ? (
                <CheckCircle2 className="h-5 w-5 text-success-500" />
              ) : locked && isSelected ? (
                <XCircle className="h-5 w-5 text-error-500" />
              ) : (
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected ? "border-primary-500 bg-primary-500" : "border-neutral-300"
                  }`}
                >
                  {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
              )}
            </span>
            <span className="text-sm text-neutral-700">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function FillBlank({
  question,
  answer,
  onAnswer,
  locked,
}: {
  question: LearnerQuestion;
  answer: QuizAnswer | undefined;
  onAnswer: (a: QuizAnswer) => void;
  locked: boolean;
}) {
  const count = question.blankCount ?? 0;
  const values = answer && "blanks" in answer ? answer.blanks : [];

  return (
    <div className="space-y-2">
      {Array.from({ length: count }, (_, i) => (
        <label key={i} className="flex items-center gap-3">
          <span className="w-8 shrink-0 text-xs font-semibold text-neutral-400">[{i + 1}]</span>
          <input
            className="h-10 flex-1 rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50"
            value={values[i] ?? ""}
            disabled={locked}
            placeholder={`Answer for blank ${i + 1}`}
            onChange={(e) => {
              const next = [...values];
              next[i] = e.target.value;
              onAnswer({ blanks: next });
            }}
          />
        </label>
      ))}
    </div>
  );
}

function ShortAnswer({
  answer,
  onAnswer,
  locked,
}: {
  answer: QuizAnswer | undefined;
  onAnswer: (a: QuizAnswer) => void;
  locked: boolean;
}) {
  return (
    <input
      className="h-10 w-full rounded-lg border border-neutral-200 bg-white px-3 text-sm text-neutral-700 outline-none transition-colors focus:border-primary-400 focus:ring-2 focus:ring-primary-100 disabled:bg-neutral-50"
      value={answer && "text" in answer ? answer.text : ""}
      disabled={locked}
      placeholder="Type your answer…"
      onChange={(e) => onAnswer({ text: e.target.value })}
    />
  );
}

function Matching({
  question,
  answer,
  onAnswer,
  locked,
}: {
  question: LearnerQuestion;
  answer: QuizAnswer | undefined;
  onAnswer: (a: QuizAnswer) => void;
  locked: boolean;
}) {
  const pairs = answer && "pairs" in answer ? answer.pairs : {};
  const right = question.right ?? [];

  return (
    <div className="space-y-2">
      {(question.left ?? []).map((left, li) => (
        <div key={li} className="flex items-center gap-3">
          <span className="flex-1 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
            {left}
          </span>
          <span aria-hidden className="shrink-0 text-neutral-300">
            →
          </span>
          <SearchableSelect
            className="min-w-0 flex-1"
            value={pairs[li] ?? ""}
            disabled={locked}
            aria-label={`Match for ${left}`}
            onChange={(v) => onAnswer({ pairs: { ...pairs, [li]: v } })}
            placeholder="Choose a match…"
            clearable
            clearLabel="Choose a match…"
            options={right.map((option) => ({ value: option, label: option }))}
          />
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** A question counts as answered only once every input it needs is filled. */
function isAnswered(question: LearnerQuestion, answer: QuizAnswer | undefined): boolean {
  if (!answer) return false;

  switch (question.type) {
    case "multiple_choice":
      return "choice" in answer && answer.choice >= 0;
    case "short_answer":
      return "text" in answer && answer.text.trim().length > 0;
    case "fill_blank": {
      if (!("blanks" in answer)) return false;
      const count = question.blankCount ?? 0;
      return answer.blanks.length >= count && answer.blanks.slice(0, count).every((b) => b?.trim());
    }
    case "matching":
      return (
        "pairs" in answer && (question.left ?? []).every((_, i) => Boolean(answer.pairs[i]?.trim()))
      );
  }
}

function formatCorrectAnswer(question: LearnerQuestion, correct: unknown): string {
  if (question.type === "multiple_choice" && typeof correct === "number") {
    return question.options?.[correct] ?? "—";
  }
  if (Array.isArray(correct)) {
    return question.type === "matching"
      ? (question.left ?? []).map((l, i) => `${l} → ${correct[i]}`).join(", ")
      : correct.join(", ");
  }
  return String(correct ?? "—");
}

/**
 * A countdown, as minutes and seconds.
 *
 * Clamped at zero rather than going negative: the submission is already on its
 * way when it gets there, and "-0:03" on screen reads as a fault.
 */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
