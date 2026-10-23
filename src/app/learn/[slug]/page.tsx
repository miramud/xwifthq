"use client";

import { useState, useEffect, useCallback, useMemo, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Menu,
  PanelRightClose,
  PanelRightOpen,
  FileText,
  BookOpen,
  StickyNote,
  MessageSquare,
  Megaphone,
  CloudOff,
  RefreshCw,
  Clock,
  Info,
  Paperclip,
  Download,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { useAuth } from "@/lib/auth-store";
import {
  getLearnerCourse,
  getMyCourses,
  saveProgress,
  ApiError,
  type LearnerCourse,
  type LearnerLecture,
  type LearnerArticleContent,
  type LearnerVideoContent,
  type LearnerDocumentContent,
} from "@/lib/api/learn-client";
import { sanitizeHtml } from "@/lib/sanitize-html";
import LessonVideo, { isEmbeddedProvider } from "@/suite/lms/components/learn/LessonVideo";
import QuizPlayer from "@/suite/lms/components/learn/QuizPlayer";
import LessonQuestions from "@/suite/lms/components/learn/LessonQuestions";
import LessonAnnouncements from "@/suite/lms/components/learn/LessonAnnouncements";
import LessonSidebar from "@/suite/lms/components/learn/LessonSidebar";
import CompletionModal from "@/suite/lms/components/learn/CompletionModal";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getNotesKey(slug: string, lectureId: string) {
  return `notes_${slug}_${lectureId}`;
}

interface FlatLesson {
  sectionIdx: number;
  lessonIdx: number;
  lecture: LearnerLecture;
}

function buildFlatLessons(course: LearnerCourse): FlatLesson[] {
  return course.sections.flatMap((section, sectionIdx) =>
    section.lectures.map((lecture, lessonIdx) => ({ sectionIdx, lessonIdx, lecture })),
  );
}

/* ------------------------------------------------------------------ */
/*  Document — a file the institution holds                            */
/* ------------------------------------------------------------------ */

/**
 * Deliberately not an inline preview.
 *
 * A PDF viewer embedded in the page would have to be either the browser’s,
 * which ignores every rule about platform-only material the moment somebody
 * hits its download button, or a bundled renderer, which is a megabyte of
 * JavaScript for a handbook most learners open once. Opening the file is the
 * honest version: the link is a streaming path for platform-only media, so it
 * still only works for somebody signed in and entitled to it.
 */
function DocumentContent({
  title,
  content,
}: {
  title: string;
  content: LearnerDocumentContent | null;
}) {
  const url = content?.url ?? "";
  const missing = content?.mediaMissing === true;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
          <Paperclip className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-neutral-800">{title}</h2>
          {content?.note ? (
            <p className="text-xs text-neutral-500">{content.note}</p>
          ) : null}
        </div>
      </div>

      {url === "" || missing ? (
        <div className="rounded-xl border border-dashed border-neutral-200 p-10 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-neutral-300" />
          <p className="text-sm text-neutral-500">
            {missing
              ? "This file is no longer available. Your instructor has been able to see that too."
              : "Your instructor hasn’t attached this file yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-neutral-200 p-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-neutral-800">
                {content?.name ?? title}
              </p>
              <p className="mt-0.5 text-xs text-neutral-400">
                {[fileKind(content?.mime ?? null), fileSize(content?.sizeBytes ?? null)]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>

            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
            >
              <Download size={15} />
              Open
            </a>
          </div>

          {content?.isPlatformOnly === true && (
            <p className="mt-4 flex items-center gap-1.5 border-t border-neutral-100 pt-3 text-[11px] text-neutral-400">
              <ShieldCheck size={12} className="text-success-600" />
              Only readable here. Sending the link on won’t open it for anybody else.
            </p>
          )}

          {/* Nothing tracks whether a file was read, so it is said plainly. */}
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-400">
            <Info size={12} />
            Use &ldquo;Mark as Complete&rdquo; once you&apos;ve read it.
          </p>
        </div>
      )}
    </div>
  );
}

/** A file’s type in words, for people who do not read MIME types. */
function fileKind(mime: string | null): string {
  if (mime === null || mime === "") return "";
  if (mime === "application/pdf") return "PDF";
  if (mime.includes("word")) return "Word document";
  if (mime.includes("sheet") || mime.includes("excel")) return "Spreadsheet";
  if (mime.includes("presentation") || mime.includes("powerpoint")) return "Slides";
  if (mime.startsWith("text/")) return "Text file";

  return "File";
}

function fileSize(bytes: number | null): string {
  if (bytes === null || bytes <= 0) return "";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;

  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
}

/* ------------------------------------------------------------------ */
/*  Article — the instructor's real HTML, sanitised                    */
/* ------------------------------------------------------------------ */

function ArticleContent({ title, html }: { title: string; html: string }) {
  // sanitizeHtml needs the DOM. That is fine here: the page only renders an
  // article once the course has been fetched, which never happens on the server.
  const safe = useMemo(() => sanitizeHtml(html), [html]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-100">
          <FileText className="h-5 w-5 text-primary-600" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-neutral-800">{title}</h2>
          <div className="flex items-center gap-1.5 text-xs text-neutral-400">
            <Clock className="h-3 w-3" />
            <span>{readingTime(html)} min read</span>
          </div>
        </div>
      </div>

      {html.trim() ? (
        <div
          className="prose prose-neutral max-w-none leading-relaxed text-neutral-700"
          dangerouslySetInnerHTML={{ __html: safe }}
        />
      ) : (
        <p className="rounded-xl border border-dashed border-neutral-200 p-10 text-center text-sm text-neutral-500">
          Your instructor hasn&apos;t written this article yet.
        </p>
      )}
    </div>
  );
}

function readingTime(html: string): number {
  const words = html.replace(/<[^>]*>/g, " ").trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/* ------------------------------------------------------------------ */
/*  Per-lesson notes (this device only)                                */
/* ------------------------------------------------------------------ */

/**
 * Mounted with `key={lectureId}` so switching lessons remounts it and the
 * initialiser reads that lesson's notes — no effect, no stale state.
 */
function LessonNotes({ slug, lectureId }: { slug: string; lectureId: string }) {
  const [notes, setNotes] = useState(() =>
    typeof window === "undefined" ? "" : (localStorage.getItem(getNotesKey(slug, lectureId)) ?? ""),
  );

  return (
    <div className="max-w-3xl">
      <p className="mb-3 text-sm text-neutral-500">
        Your notes for this lesson (saved on this device)
      </p>
      <textarea
        value={notes}
        onChange={(e) => {
          setNotes(e.target.value);
          localStorage.setItem(getNotesKey(slug, lectureId), e.target.value);
        }}
        placeholder="Type your notes here..."
        className="h-48 w-full resize-y rounded-xl border border-neutral-200 p-4 text-sm text-neutral-700 transition-colors placeholder:text-neutral-400 focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 sm:h-64"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */

export default function LearnPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const { updateProgress, markCourseComplete, setEnrollments, getEnrollment } = useStore();
  const { user } = useAuth();

  const [course, setCourse] = useState<LearnerCourse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  const [currentSection, setCurrentSection] = useState(0);
  const [currentLesson, setCurrentLesson] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "overview" | "notes" | "questions" | "announcements"
  >("overview");
  const [showCompletion, setShowCompletion] = useState(false);

  /**
   * Lessons the server has not accepted yet.
   *
   * Progress used to be fire-and-forget: a failed save was swallowed, the
   * lesson still went green locally, and the two only disagreed on the next
   * page load — when the tick silently vanished. Holding the failures here lets
   * the player say so and offer a retry.
   */
  const [unsaved, setUnsaved] = useState<Map<string, number>>(new Map());
  const [retrying, setRetrying] = useState(false);

  /* ---- load the real course + this learner's progress ---- */
  useEffect(() => {
    let alive = true;

    getLearnerCourse(slug)
      .then((data) => {
        if (!alive) return;
        setCourse(data);
        setCompleted(new Set(data.enrollment.progress.completedLessons));

        // Resume where they left off.
        const last = data.enrollment.progress.lastAccessedLesson;
        const flat = buildFlatLessons(data);
        const resume = flat.find((l) => l.lecture.id === last);
        if (resume) {
          setCurrentSection(resume.sectionIdx);
          setCurrentLesson(resume.lessonIdx);
        }
      })
      .catch((err: unknown) => {
        if (!alive) return;
        // 403 (payment pending / refunded) and 404 (not enrolled) both mean
        // "you cannot be here" — send them to the sales page.
        if (err instanceof ApiError && (err.status === 403 || err.status === 404)) {
          router.replace(`/courses/${slug}`);
          return;
        }
        setLoadError(
          err instanceof ApiError ? err.message : "We could not load this course. Please retry.",
        );
      });

    return () => {
      alive = false;
    };
  }, [slug, router]);

  const flatLessons = useMemo(() => (course ? buildFlatLessons(course) : []), [course]);

  const currentLecture = course?.sections[currentSection]?.lectures[currentLesson] ?? null;
  const currentFlatIndex = flatLessons.findIndex(
    (l) => l.sectionIdx === currentSection && l.lessonIdx === currentLesson,
  );

  const canGoPrev = currentFlatIndex > 0;
  const canGoNext = currentFlatIndex >= 0 && currentFlatIndex < flatLessons.length - 1;

  const progress = useMemo(() => {
    const total = flatLessons.length;
    const done = flatLessons.filter((l) => completed.has(l.lecture.id)).length;
    return { total, completed: done, percent: total ? Math.round((done / total) * 100) : 0 };
  }, [flatLessons, completed]);

  /* ---- navigation ---- */
  const goToLesson = useCallback((sectionIdx: number, lessonIdx: number) => {
    setCurrentSection(sectionIdx);
    setCurrentLesson(lessonIdx);
    setActiveTab("overview");
    window.scrollTo({ top: 0 });
  }, []);

  const goToPrev = useCallback(() => {
    if (!canGoPrev) return;
    const prev = flatLessons[currentFlatIndex - 1];
    goToLesson(prev.sectionIdx, prev.lessonIdx);
  }, [canGoPrev, flatLessons, currentFlatIndex, goToLesson]);

  const goToNext = useCallback(() => {
    if (!canGoNext) return;
    const next = flatLessons[currentFlatIndex + 1];
    goToLesson(next.sectionIdx, next.lessonIdx);
  }, [canGoNext, flatLessons, currentFlatIndex, goToLesson]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || tag === "SELECT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goToPrev, goToNext]);

  /* ---- completion ---- */
  const isCurrentCompleted = currentLecture ? completed.has(currentLecture.id) : false;

  const handleMarkComplete = useCallback(() => {
    if (!currentLecture || completed.has(currentLecture.id)) return;

    const lessonId = currentLecture.id;
    const sectionIndex = currentSection;
    const next = new Set(completed).add(lessonId);
    setCompleted(next);

    // Optimistic locally so the tick lands immediately, but the server is the
    // source of truth — a rejected save is recorded and surfaced, not dropped.
    updateProgress(slug, lessonId, sectionIndex);

    void saveProgress(slug, lessonId, sectionIndex).then((ok) => {
      if (!ok) {
        setUnsaved((prev) => new Map(prev).set(lessonId, sectionIndex));
      }
    });

    if (next.size >= flatLessons.length && flatLessons.length > 0) {
      markCourseComplete(slug);
      setShowCompletion(true);

      // The API issues the completion certificate as part of that last progress
      // write, so re-read the enrollments to pick up its serial. Best-effort:
      // the modal just omits the certificate button if it does not arrive.
      void getMyCourses().then((courses) => {
        if (courses.length > 0) setEnrollments(courses);
      });
    }
  }, [currentLecture, completed, slug, currentSection, updateProgress, flatLessons.length, markCourseComplete, setEnrollments]);

  /** Re-send everything the server has not acknowledged. */
  const retryUnsaved = useCallback(async () => {
    setRetrying(true);

    const entries = [...unsaved.entries()];
    const results = await Promise.all(
      entries.map(([lessonId, sectionIndex]) =>
        saveProgress(slug, lessonId, sectionIndex).then((ok) => [lessonId, ok] as const),
      ),
    );

    setUnsaved((prev) => {
      const remaining = new Map(prev);
      for (const [lessonId, ok] of results) {
        if (ok) remaining.delete(lessonId);
      }
      return remaining;
    });

    setRetrying(false);
  }, [slug, unsaved]);

  /* ---- render states ---- */
  if (loadError) {
    return (
      <Centered>
        <p className="mb-4 text-neutral-500">{loadError}</p>
        <Link href="/my-courses" className="btn-primary">
          Back to my courses
        </Link>
      </Centered>
    );
  }

  if (!course) {
    return (
      <Centered>
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-primary-200 border-t-primary-600" />
      </Centered>
    );
  }

  if (flatLessons.length === 0 || !currentLecture) {
    return (
      <Centered>
        <p className="mb-4 text-neutral-500">
          This course has no lessons yet. Check back shortly.
        </p>
        <Link href="/my-courses" className="btn-primary">
          Back to my courses
        </Link>
      </Centered>
    );
  }

  const sectionTitle = course.sections[currentSection]?.title ?? "";
  const gradient = course.gradient ?? "from-primary-400 to-primary-600";

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col bg-white">
        {/* ============ TOP BAR ============ */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-200/80 bg-white px-3 text-neutral-900 sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/my-courses"
              className="shrink-0 rounded-full p-2 transition-colors hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              title="Back to my courses"
              aria-label="Back to my courses"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </Link>
            <h1 className="max-w-[180px] truncate font-heading text-sm font-semibold sm:max-w-sm lg:max-w-lg">
              {course.title}
            </h1>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <div className="relative h-8 w-8">
                <svg className="h-8 w-8 -rotate-90" viewBox="0 0 32 32" aria-hidden="true">
                  <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary-100" />
                  <circle
                    cx="16"
                    cy="16"
                    r="13"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${(progress.percent / 100) * 81.68} 81.68`}
                    strokeLinecap="round"
                    className="text-primary-600 transition-all duration-500"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
                  {progress.percent}%
                </span>
              </div>
              <span className="hidden text-xs text-neutral-500 sm:inline">
                {progress.completed}/{progress.total}
              </span>
            </div>

            <button
              onClick={() => setSidebarOpen((o) => !o)}
              className="rounded-full p-2 transition-colors hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-label={sidebarOpen ? "Close the lesson list" : "Open the lesson list"}
            >
              <span className="hidden lg:block">
                {sidebarOpen ? <PanelRightClose className="h-5 w-5" /> : <PanelRightOpen className="h-5 w-5" />}
              </span>
              <span className="lg:hidden">
                <Menu className="h-5 w-5" />
              </span>
            </button>
          </div>
        </header>

        {/* ============ MAIN AREA ============ */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex flex-1 flex-col overflow-y-auto">
            <div className="flex-1">
              {currentLecture.type === "video" && (
                <div className="bg-neutral-900">
                  <LessonVideo
                    url={(currentLecture.content as LearnerVideoContent | null)?.url ?? ""}
                    title={currentLecture.title}
                    gradient={gradient}
                    courseSlug={slug}
                    lectureId={currentLecture.id}
                    onComplete={handleMarkComplete}
                  />
                  {isEmbeddedProvider((currentLecture.content as LearnerVideoContent | null)?.url ?? "") && (
                    <p className="flex items-center justify-center gap-1.5 bg-neutral-900 px-4 py-2 text-[11px] text-neutral-400">
                      <Info size={12} />
                      Hosted elsewhere, so use &ldquo;Mark as complete&rdquo; when you&apos;re done.
                    </p>
                  )}
                </div>
              )}

              {currentLecture.type === "article" && (
                <div className="p-6 sm:p-8">
                  <ArticleContent
                    title={currentLecture.title}
                    html={(currentLecture.content as LearnerArticleContent | null)?.html ?? ""}
                  />
                </div>
              )}

              {currentLecture.type === "document" && (
                <div className="p-6 sm:p-8">
                  <DocumentContent
                    title={currentLecture.title}
                    content={currentLecture.content as LearnerDocumentContent | null}
                  />
                </div>
              )}

              {currentLecture.type === "quiz" && (
                <div className="p-6 sm:p-8">
                  <QuizPlayer
                    courseSlug={slug}
                    lectureId={currentLecture.id}
                    title={currentLecture.title}
                    onComplete={handleMarkComplete}
                  />
                </div>
              )}

              {/* ============ LESSON INFO TABS ============ */}
              <div className="border-t border-neutral-200">
                <div className="flex border-b border-neutral-200 px-4 sm:px-6">
                  {(
                    [
                      { key: "overview", label: "Overview", icon: BookOpen },
                      { key: "notes", label: "Notes", icon: StickyNote },
                      { key: "questions", label: "Q&A", icon: MessageSquare },
                      { key: "announcements", label: "Announcements", icon: Megaphone },
                    ] as const
                  ).map(({ key, label, icon: Icon }) => (
                    <button
                      key={key}
                      onClick={() => setActiveTab(key)}
                      aria-label={label}
                      aria-pressed={activeTab === key}
                      className={`-mb-px flex items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                        activeTab === key
                          ? "border-primary-600 text-primary-700"
                          : "border-transparent text-neutral-500 hover:text-neutral-700"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  ))}
                </div>

                <div className="p-4 pb-28 sm:p-6">
                  {activeTab === "overview" && (
                    <div className="max-w-3xl space-y-4">
                      <div>
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-primary-600">
                          Section {currentSection + 1} &middot; {sectionTitle}
                        </p>
                        <h3 className="font-heading text-xl font-semibold text-neutral-800">
                          {currentLecture.title}
                        </h3>
                        <div className="mt-2 flex items-center gap-3 text-sm text-neutral-500">
                          <span className="capitalize">{currentLecture.type}</span>
                          {currentLecture.duration && (
                            <>
                              <span>&middot;</span>
                              <span>{currentLecture.duration}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {course.shortDescription && (
                        <p className="leading-relaxed text-neutral-600">{course.shortDescription}</p>
                      )}
                      <p className="text-sm text-neutral-500">
                        Taught by {course.instructor.name ?? "your instructor"}.
                      </p>
                    </div>
                  )}

                  {activeTab === "notes" && (
                    <LessonNotes key={currentLecture.id} slug={slug} lectureId={currentLecture.id} />
                  )}

                  {activeTab === "questions" && (
                    <LessonQuestions
                      courseSlug={slug}
                      lectureId={currentLecture.id}
                      lectureTitle={currentLecture.title}
                    />
                  )}

                  {activeTab === "announcements" && <LessonAnnouncements courseSlug={slug} />}
                </div>
              </div>
            </div>
          </div>

          <LessonSidebar
            course={course}
            currentSection={currentSection}
            currentLesson={currentLesson}
            completedLessons={completed}
            onSelectLesson={goToLesson}
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
            progressPercent={progress.percent}
            progressCompleted={progress.completed}
            progressTotal={progress.total}
          />
        </div>

        {/*
          Sits directly above the bottom bar, where the "Mark as complete"
          button is: the failure is reported next to the control that caused
          it, not in a corner toast that has already vanished.
        */}
        {unsaved.size > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-warning-400/40 bg-warning-400/10 px-4 py-2.5 sm:px-6"
          >
            <p className="flex items-center gap-2 text-sm text-neutral-700">
              <CloudOff className="h-4 w-4 shrink-0 text-warning-600" aria-hidden="true" />
              <span>
                {unsaved.size === 1
                  ? "1 lesson hasn't saved to your account yet."
                  : `${unsaved.size} lessons haven't saved to your account yet.`}
              </span>
            </p>

            <button
              type="button"
              onClick={retryUnsaved}
              disabled={retrying}
              className="inline-flex items-center gap-1.5 rounded-full bg-neutral-900 px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-neutral-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-1 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${retrying ? "animate-spin motion-reduce:animate-none" : ""}`}
                aria-hidden="true"
              />
              {retrying ? "Saving…" : "Retry now"}
            </button>
          </div>
        )}

        {/* ============ BOTTOM BAR ============ */}
        <footer className="flex h-16 shrink-0 items-center justify-between border-t border-neutral-200 bg-white px-4 sm:px-6">
          <button
            onClick={goToPrev}
            disabled={!canGoPrev}
            aria-label="Previous lesson"
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              canGoPrev ? "text-neutral-700 hover:bg-primary-50 hover:text-primary-700" : "cursor-not-allowed text-neutral-300"
            }`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Previous</span>
          </button>

          <button
            onClick={handleMarkComplete}
            disabled={isCurrentCompleted}
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
              isCurrentCompleted
                ? "cursor-default border border-success-200 bg-success-50 text-success-700"
                : "bg-primary-600 text-white shadow-[0_10px_24px_-10px_rgb(150_56_205/0.7)] hover:bg-primary-700 active:scale-[0.98]"
            }`}
          >
            {isCurrentCompleted ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Completed
              </>
            ) : (
              "Mark as complete"
            )}
          </button>

          <button
            onClick={goToNext}
            disabled={!canGoNext}
            aria-label="Next lesson"
            className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
              canGoNext ? "text-neutral-700 hover:bg-primary-50 hover:text-primary-700" : "cursor-not-allowed text-neutral-300"
            }`}
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </footer>
      </div>

      {showCompletion && (
        <CompletionModal
          courseTitle={course.title}
          courseSlug={slug}
          recipientName={user?.name}
          // Issued server-side the moment the last lesson is recorded, then
          // pulled in by the refresh in handleMarkComplete. Absent when the
          // course offers no certificate — the modal then hides that button
          // rather than offering a download it cannot produce.
          certificateSerial={getEnrollment(slug)?.certificateSerial}
          onClose={() => setShowCompletion(false)}
        />
      )}
    </>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="xw-sky fixed inset-0 z-50 flex items-center justify-center px-4">
      <div className="text-center">{children}</div>
    </div>
  );
}
