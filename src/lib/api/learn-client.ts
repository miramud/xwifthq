/* ------------------------------------------------------------------ */
/*  Browser-side client for the enrolled-learner course player.        */
/* ------------------------------------------------------------------ */

"use client";

import { ApiError } from "./admin-client";
import type { QuizQuestionType } from "@/suite/lms/lib/curriculum";
import type { EnrolledCourse } from "@/lib/store";

/* ---------- Lecture content, as the learner receives it ---------- */

export interface LearnerVideoContent {
  source: "link" | "upload";
  url: string;
  provider: string | null;
}

export interface LearnerArticleContent {
  html: string;
}

/**
 * A file attached to a lesson, already resolved by the API.
 *
 * `url` is the only field a browser should follow. For a platform-only file it
 * is a streaming path on this origin and never the provider's own location —
 * which is what stops the link being useful to somebody who is not signed in.
 */
export interface LearnerDocumentContent {
  url: string;
  name?: string;
  note?: string;
  mime?: string | null;
  sizeBytes?: number | null;
  isPlatformOnly?: boolean;
  /** The author attached a file and it was later deleted from the library. */
  mediaMissing?: boolean;
}

/**
 * A quiz question with its answer key removed. `right` for a matching question
 * is sorted, not in pair order, so its position reveals nothing.
 */
export interface LearnerQuestion {
  id: string;
  type: QuizQuestionType;
  prompt: string;
  points: number;
  options?: string[];
  blankCount?: number;
  left?: string[];
  right?: string[];
}

export interface LearnerQuizContent {
  /**
   * Empty where the quiz has to be started first: sending the whole bank a
   * learner will be asked ten of would defeat it before the sitting endpoint
   * is ever called.
   */
  questions: LearnerQuestion[];
  passMark: number;
  /** Null means unlimited. */
  maxAttempts: number | null;
  /** Null means untimed. */
  timeLimitMinutes: number | null;
  /** How many will actually be asked — fewer than the bank holds. */
  questionCount: number;
  mustBeStarted: boolean;
}

/** What a sitting looks like once opened. */
export interface QuizSitting {
  /** Null on a plain quiz, which needs no sitting at all. */
  sessionId: string | null;
  questions: LearnerQuestion[];
  expiresAt: string | null;
  passMark: number;
  used: number;
  /** Null means unlimited. */
  remaining: number | null;
  passed: boolean;
  mayAttempt: boolean;
}

/** One finished attempt, for looking back at. */
export interface PastAttempt {
  id: string;
  score: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  takenAt: string | null;
  answers: {
    questionId: string;
    /** Null where the question has since been edited away. */
    prompt: string | null;
    type: string;
    isCorrect: boolean;
    points: number;
    earned: number;
    response: Record<string, unknown> | null;
    wasSkipped: boolean;
    correctAnswer: unknown;
    explanation: string | null;
  }[];
}

export type LearnerContent =
  | LearnerVideoContent
  | LearnerArticleContent
  | LearnerDocumentContent
  | LearnerQuizContent
  | null;

export interface LearnerLecture {
  id: string;
  title: string;
  duration: string | null;
  type: "video" | "article" | "document" | "quiz";
  content: LearnerContent;
}

export interface LearnerSection {
  id: string;
  title: string;
  lectures: LearnerLecture[];
}

export interface LearnerCourse {
  slug: string;
  title: string;
  shortDescription: string;
  gradient: string | null;
  level: string;
  duration: string | null;
  totalLectures: number;
  totalHours: number;
  hasCertificate: boolean;
  instructor: { name: string | null; title: string | null; avatar: string | null };
  enrollment: {
    status: string;
    enrolledAt: string;
    progress: {
      completedLessons: string[];
      lastAccessedLesson: string;
      lastAccessedSection: number;
      completedAt: string | null;
    };
  };
  sections: LearnerSection[];
}

/* ---------- Quiz grading ---------- */

/** One learner answer, shaped per question type. */
export type QuizAnswer =
  | { choice: number }
  | { blanks: string[] }
  | { text: string }
  | { pairs: Record<number, string> };

export interface QuizQuestionResult {
  id: string;
  correct: boolean;
  points: number;
  earned: number;
  explanation: string | null;
  correctAnswer: unknown;
}

export interface QuizResult {
  score: number;
  maxScore: number;
  correctCount: number;
  total: number;
  percentage: number;
  passed: boolean;
  passMark: number;
  results: QuizQuestionResult[];
  /* Where the quiz rations attempts, how they stand after this one. */
  used?: number;
  remaining?: number | null;
  mayAttempt?: boolean;
}

/* ---------- Requests ---------- */

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body?.message ?? "Request failed.", res.status);
  return body as T;
}

/** The full lesson payload for a course the learner is actively enrolled in. */
export async function getLearnerCourse(slug: string): Promise<LearnerCourse> {
  const res = await fetch(`/api/me/courses/${encodeURIComponent(slug)}/content`, {
    cache: "no-store",
  });
  return (await json<{ course: LearnerCourse }>(res)).course;
}

export async function startQuiz(
  slug: string,
  lectureId: string,
): Promise<QuizSitting> {
  const res = await fetch(
    `/api/me/courses/${encodeURIComponent(slug)}/quiz/start`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lectureId }),
    },
  );

  return (await json<{ result: QuizSitting }>(res)).result;
}

export async function gradeQuiz(
  slug: string,
  lectureId: string,
  answers: Record<string, QuizAnswer>,
  /** Required for a quiz that rations anything; the server refuses without it. */
  sessionId?: string | null,
): Promise<QuizResult> {
  const res = await fetch(`/api/me/courses/${encodeURIComponent(slug)}/quiz`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lectureId, answers, sessionId: sessionId ?? undefined }),
  });
  return (await json<{ result: QuizResult }>(res)).result;
}

/** Everything this learner has already done on one quiz. */
export async function getQuizAttempts(
  slug: string,
  lectureId: string,
): Promise<PastAttempt[]> {
  const res = await fetch(
    `/api/me/courses/${encodeURIComponent(slug)}/quiz/attempts?lectureId=${encodeURIComponent(lectureId)}`,
  );

  return (await json<{ attempts: PastAttempt[] }>(res)).attempts ?? [];
}

/**
 * Report how far into a video the learner has got.
 *
 * Fire and forget. A dropped ping is a slightly shorter retention curve, and
 * making a video wait on telemetry would be absurd — so this never throws and
 * never blocks playback.
 */
export function reportVideoProgress(
  slug: string,
  lectureId: string,
  positionSeconds: number,
  durationSeconds: number,
): void {
  void fetch(`/api/me/courses/${encodeURIComponent(slug)}/views`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lectureId, positionSeconds, durationSeconds }),
    keepalive: true,
  }).catch(() => {
    /* Telemetry. Nothing the learner needs to know about. */
  });
}

/* ---------- Course Q&A (learner side) ---------- */

export interface LearnerQuestionMessage {
  id: string;
  from: "student" | "instructor";
  authorRole: "student" | "instructor" | "admin";
  author: string | null;
  body: string;
  createdAt: string;
}

/**
 * A Q&A thread.
 *
 * Named apart from the quiz `LearnerQuestion` above deliberately. Both were
 * called `LearnerQuestion` and exported from this one module, which TypeScript
 * does not reject — it *merges* them, so every consumer of either was silently
 * typed against the union of both. Nothing broke only because neither side
 * ever constructs one.
 */
export interface LearnerQuestionThread {
  id: string;
  reference: string;
  subject: string;
  courseSlug: string | null;
  courseTitle: string | null;
  lesson: string | null;
  preview: string;
  resolved: boolean;
  awaitingReply: boolean;
  lastReplyAt: string;
  createdAt: string;
  messages?: LearnerQuestionMessage[];
}

/** This learner's threads, optionally narrowed to one course. */
export async function getMyQuestions(courseSlug?: string): Promise<LearnerQuestionThread[]> {
  const qs = courseSlug ? `?courseSlug=${encodeURIComponent(courseSlug)}` : "";
  const res = await fetch(`/api/me/questions${qs}`, { cache: "no-store" });
  return (await json<{ questions: LearnerQuestionThread[] }>(res)).questions;
}

/** Ask the instructor a question, optionally about the lecture being watched. */
export async function askQuestion(
  slug: string,
  input: { subject: string; body: string; lectureId?: string },
): Promise<LearnerQuestionThread> {
  const res = await fetch(`/api/me/courses/${encodeURIComponent(slug)}/questions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await json<{ question: LearnerQuestionThread }>(res)).question;
}

export async function replyToQuestion(id: string, body: string): Promise<LearnerQuestionThread> {
  const res = await fetch(`/api/me/questions/${encodeURIComponent(id)}/replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body }),
  });
  return (await json<{ question: LearnerQuestionThread }>(res)).question;
}

/**
 * Save a completed lesson.
 *
 * Resolves `true` when the server has it and `false` when it does not. It used
 * to swallow every failure, which meant a learner could tick off a lesson, see
 * it go green, and have the server never hear about it — the local store and
 * the backend then disagreed silently until the next page load reverted the
 * tick. The player now surfaces the failure and offers a retry.
 */
export async function saveProgress(
  slug: string,
  lessonId: string,
  sectionIndex: number,
): Promise<boolean> {
  try {
    const res = await fetch(`/api/me/courses/${encodeURIComponent(slug)}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lessonId, sectionIndex }),
    });

    return res.ok;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Enrollments                                                        */
/* ------------------------------------------------------------------ */

/**
 * This learner's enrolled courses, in the shape the local store holds.
 *
 * Used to re-read enrollments after the API has changed them behind the scenes
 * — most importantly right after the final lesson, when the completion
 * certificate has just been issued and its serial is not in the store yet.
 *
 * Returns an empty list rather than throwing: every caller so far is a
 * best-effort refresh where a failure should leave the existing store alone.
 */
export async function getMyCourses(): Promise<EnrolledCourse[]> {
  try {
    const res = await fetch("/api/me/courses", { cache: "no-store" });
    if (!res.ok) return [];

    const body = (await res.json()) as { courses?: EnrolledCourse[] };
    return Array.isArray(body.courses) ? body.courses : [];
  } catch {
    return [];
  }
}

/* ------------------------------------------------------------------ */
/*  Announcements                                                      */
/* ------------------------------------------------------------------ */

export interface LearnerAnnouncement {
  id: string;
  title: string;
  body: string;
  course: string | null;
  courseSlug: string | null;
  instructor: string | null;
  instructorInitials: string | null;
  isBroadcast: boolean;
  sentOn: string;
}

/** Announcements on one course, plus that instructor's broadcasts. */
export async function getCourseAnnouncements(slug: string): Promise<LearnerAnnouncement[]> {
  const res = await fetch(`/api/me/courses/${encodeURIComponent(slug)}/announcements`, {
    cache: "no-store",
  });
  return (await json<{ announcements: LearnerAnnouncement[] }>(res)).announcements;
}

/* ------------------------------------------------------------------ */
/*  Reviews                                                            */
/* ------------------------------------------------------------------ */

export interface LearnerReview {
  id: string;
  rating: number;
  body: string;
  status: string;
  courseSlug: string | null;
  courseTitle: string | null;
  reply: string | null;
  date: string;
}

/**
 * Write or update this learner's review. The API upserts, so calling it again
 * edits the existing review rather than failing — a learner changing their mind
 * partway through a course is the normal case, not an error.
 */
export async function saveReview(
  slug: string,
  input: { rating: number; comment: string },
): Promise<LearnerReview> {
  const res = await fetch(`/api/me/courses/${encodeURIComponent(slug)}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await json<{ review: LearnerReview }>(res)).review;
}

export async function getMyReviews(): Promise<LearnerReview[]> {
  const res = await fetch("/api/me/reviews", { cache: "no-store" });
  return (await json<{ reviews: LearnerReview[] }>(res)).reviews;
}

export async function withdrawReview(slug: string): Promise<void> {
  const res = await fetch(`/api/me/courses/${encodeURIComponent(slug)}/reviews`, {
    method: "DELETE",
  });
  await json<{ ok: boolean }>(res);
}

export { ApiError };
