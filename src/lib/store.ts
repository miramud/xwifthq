"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import React from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface EnrolledCourseProgress {
  completedLessons: string[];
  lastAccessedLesson: string;
  lastAccessedSection: number;
  completedAt: string | null;
}

export interface EnrolledCourse {
  slug: string;
  title: string;
  enrolledAt: string;
  instructor: { name: string };
  gradient: string;
  duration: string;
  totalLectures: number;
  totalHours: number;
  hasCertificate?: boolean;
  /** Present once a completion certificate has been issued. */
  certificateSerial?: string | null;
  progress: EnrolledCourseProgress;
}

export interface ProgressSummary {
  completed: number;
  total: number;
  percent: number;
}

interface StoreState {
  /* enrollment */
  enrolledCourses: EnrolledCourse[];
  enroll: (course: Omit<EnrolledCourse, "enrolledAt" | "progress">) => void;
  setEnrollments: (courses: EnrolledCourse[]) => void;
  isEnrolled: (slug: string) => boolean;
  getEnrollment: (slug: string) => EnrolledCourse | undefined;
  updateProgress: (slug: string, lessonId: string, sectionIndex: number) => void;
  getProgress: (slug: string) => ProgressSummary;
  markCourseComplete: (slug: string) => void;
}

/* ------------------------------------------------------------------ */
/*  Context                                                            */
/* ------------------------------------------------------------------ */

const StoreContext = createContext<StoreState | null>(null);

/* ------------------------------------------------------------------ */
/*  localStorage helpers                                               */
/* ------------------------------------------------------------------ */

const ENROLLED_KEY = "elevate_enrolled";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded — silently ignore */
  }
}

/* ------------------------------------------------------------------ */
/*  Provider                                                           */
/* ------------------------------------------------------------------ */

export function StoreProvider({ children }: { children: ReactNode }) {

  /**
   * `null` until something has loaded — the localStorage seed or the API.
   *
   * The distinction matters because the seed below is deferred into a
   * `requestAnimationFrame`, and a page that asks the server on mount can
   * easily get its answer first. The frame then fires and, if it simply
   * assigned, would overwrite the real enrollments with whatever the browser
   * had cached — nothing at all on a fresh device. The symptom is a list of
   * courses that appears and then vanishes, or an empty state for somebody
   * enrolled in nine things.
   *
   * So the frame seeds only when nothing has been set, which a functional
   * update can tell without a flag. An empty array is a real answer — "you
   * hold nothing" — and is kept, where a `length === 0` check would throw it
   * away and re-seed from a stale cache.
   */
  const [storedEnrollments, setStoredEnrollments] = useState<
    EnrolledCourse[] | null
  >(null);

  const [hydrated, setHydrated] = useState(false);

  const enrolledCourses = useMemo(
    () => storedEnrollments ?? [],
    [storedEnrollments],
  );

  /* hydrate from localStorage after mount (SSR-safe) — deferred off the
     synchronous effect body so it isn't a cascading in-effect setState */
  useEffect(() => {
    const raf = requestAnimationFrame(() => {

      // The cache is a fallback, never an override.
      setStoredEnrollments(
        (current) => current ?? loadFromStorage<EnrolledCourse[]>(ENROLLED_KEY, []),
      );

      setHydrated(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  /* persist on change (skip the initial empty-state write) */
  useEffect(() => {
    if (hydrated) saveToStorage(ENROLLED_KEY, enrolledCourses);
  }, [enrolledCourses, hydrated]);


  /* ------ Enrollment actions ------ */

  const enroll = useCallback(
    (course: Omit<EnrolledCourse, "enrolledAt" | "progress">) => {
      setStoredEnrollments((stored) => {
        // A write implies the list exists; an unloaded store starts from empty.
        const prev = stored ?? [];

        if (prev.some((c) => c.slug === course.slug)) return prev;
        const enrolled: EnrolledCourse = {
          ...course,
          enrolledAt: new Date().toISOString(),
          progress: {
            completedLessons: [],
            lastAccessedLesson: "",
            lastAccessedSection: 0,
            completedAt: null,
          },
        };
        return [...prev, enrolled];
      });
    },
    [],
  );

  /* Replace the whole enrolled set (e.g. after syncing from the backend). */
  /**
   * Replace the cached enrollments with what the server says.
   *
   * Setting a real array — even an empty one — is what stops the deferred
   * localStorage seed undoing this if it happens to run afterwards. Marking
   * the store hydrated lets the persist effect write the fresh list back to
   * the cache.
   */
  const setEnrollments = useCallback((courses: EnrolledCourse[]) => {
    setStoredEnrollments(courses);
    setHydrated(true);
  }, []);

  const isEnrolled = useCallback(
    (slug: string) => enrolledCourses.some((c) => c.slug === slug),
    [enrolledCourses],
  );

  const getEnrollment = useCallback(
    (slug: string) => enrolledCourses.find((c) => c.slug === slug),
    [enrolledCourses],
  );

  const updateProgress = useCallback(
    (slug: string, lessonId: string, sectionIndex: number) => {
      setStoredEnrollments((stored) =>
        (stored ?? []).map((c) => {
          if (c.slug !== slug) return c;
          const completed = c.progress.completedLessons.includes(lessonId)
            ? c.progress.completedLessons
            : [...c.progress.completedLessons, lessonId];
          return {
            ...c,
            progress: {
              ...c.progress,
              completedLessons: completed,
              lastAccessedLesson: lessonId,
              lastAccessedSection: sectionIndex,
            },
          };
        }),
      );
    },
    [],
  );

  const getProgress = useCallback(
    (slug: string): ProgressSummary => {
      const course = enrolledCourses.find((c) => c.slug === slug);
      if (!course) return { completed: 0, total: 0, percent: 0 };
      const completed = course.progress.completedLessons.length;
      const total = course.totalLectures;
      const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
      return { completed, total, percent };
    },
    [enrolledCourses],
  );

  const markCourseComplete = useCallback((slug: string) => {
    setStoredEnrollments((stored) =>
      (stored ?? []).map((c) => {
        if (c.slug !== slug) return c;
        return {
          ...c,
          progress: {
            ...c.progress,
            completedAt: new Date().toISOString(),
          },
        };
      }),
    );
  }, []);

  /* ------ Context value ------ */

  const value = useMemo<StoreState>(
    () => ({
      enrolledCourses,
      enroll,
      setEnrollments,
      isEnrolled,
      getEnrollment,
      updateProgress,
      getProgress,
      markCourseComplete,
    }),
    [
      enrolledCourses,
      enroll,
      setEnrollments,
      isEnrolled,
      getEnrollment,
      updateProgress,
      getProgress,
      markCourseComplete,
    ],
  );

  return React.createElement(StoreContext.Provider, { value }, children);
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error("useStore must be used within a <StoreProvider>");
  }
  return ctx;
}
