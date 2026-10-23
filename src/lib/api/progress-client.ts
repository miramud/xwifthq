/**
 * Course progress, shaped for charts.
 *
 * Four questions, and the API keeps them apart because they are genuinely
 * different: one person on one course, everyone on one course, one person
 * across everything, and everyone across everything.
 *
 * Every series carries `backfilled` alongside `completed`. Progress recorded
 * before the API started logging *when* each lecture was finished has no real
 * timestamp and is all stamped with one date — a chart must show that as a
 * cutover rather than a spike on a day nothing happened.
 */

/* ------------------------------------------------------------------ */
/*  Shared shapes                                                      */
/* ------------------------------------------------------------------ */

export interface ProgressPoint {
  /** ISO date, e.g. "2026-09-18". */
  date: string;
  /** Short display label, e.g. "18 Sep". */
  label: string;
  /** Lectures finished on this day, measured. */
  completed: number;
  /** Lectures attributed to this day by the backfill, not measured. */
  backfilled: number;
  /** Running total, carrying everything done before the window opened. */
  cumulative: number;
  /** Share of the course finished by this day. Null on multi-course series. */
  percent: number | null;
}

export interface ProgressBand {
  label: string;
  learners: number;
  share: number;
}

export interface LectureFunnelRow {
  position: number;
  section: string;
  title: string;
  completed: number;
  share: number;
  /** Against the lecture before it — the question is who stopped *here*. */
  dropOff: number;
}

export interface SectionProgress {
  title: string;
  lectures: number;
  completed: number;
  percent: number;
}

/* ------------------------------------------------------------------ */
/*  One learner, one course                                            */
/* ------------------------------------------------------------------ */

export interface LearnerCourseProgress {
  enrolled: true;
  learner: { id: string; name: string; email: string };
  course: { slug: string; title: string; totalLectures: number };
  status: string;
  source: string;
  mandatory: boolean;
  lessonsDone: number;
  percent: number;
  enrolledAt: string | null;
  completedAt: string | null;
  firstActivityAt: string | null;
  lastActivityAt: string | null;
  /** Distinct days they finished something — not the same as lessons done. */
  activeDays: number;
  /** Null once finished: a completed course is not stalled. */
  daysSinceActivity: number | null;
  series: ProgressPoint[];
  sections: SectionProgress[];
  quiz: { attempts: number; average: number | null; passed: number };
}

export type LearnerCourseProgressResult = LearnerCourseProgress | { enrolled: false };

/** Narrows the union, so callers cannot read a field that is not there. */
export function isEnrolled(
  result: LearnerCourseProgressResult,
): result is LearnerCourseProgress {
  return result.enrolled === true;
}

/* ------------------------------------------------------------------ */
/*  Everyone, one course                                               */
/* ------------------------------------------------------------------ */

export interface CourseCohortProgress {
  course: { slug: string; title: string; totalLectures: number };
  totals: {
    learners: number;
    completed: number;
    notStarted: number;
    inProgress: number;
    /** How far people get, on average. */
    averagePercent: number;
    /**
     * What a typical learner did. Reported beside the mean because they
     * disagree, and the disagreement is the useful part: one finisher among
     * three who did nothing is a mean of 25% and a median of 0%.
     */
    medianPercent: number;
  };
  distribution: ProgressBand[];
  series: ProgressPoint[];
  lectures: LectureFunnelRow[];
  learners: {
    id: string;
    name: string | null;
    email: string | null;
    status: string;
    source: string;
    mandatory: boolean;
    lessonsDone: number;
    percent: number;
    enrolledAt: string | null;
    completedAt: string | null;
  }[];
}

/* ------------------------------------------------------------------ */
/*  One learner, every course                                          */
/* ------------------------------------------------------------------ */

export interface LearnerProgress {
  learner: { id: string; name: string; email: string };
  totals: {
    courses: number;
    completed: number;
    lessonsDone: number;
    averagePercent: number;
    /** Required training, reported on its own — it is what gets chased. */
    mandatoryCourses: number;
    mandatoryCompleted: number;
    activeDays: number;
    lastActivityAt: string | null;
  };
  series: ProgressPoint[];
  courses: {
    slug: string | null;
    title: string | null;
    gradient: string | null;
    thumbnailUrl: string | null;
    status: string;
    source: string;
    mandatory: boolean;
    lessonsDone: number;
    totalLectures: number;
    percent: number;
    completedAt: string | null;
  }[];
}

/* ------------------------------------------------------------------ */
/*  Everyone, every course                                             */
/* ------------------------------------------------------------------ */

export interface CohortProgress {
  totals: {
    learners: number;
    enrollments: number;
    completed: number;
    notStarted: number;
    averagePercent: number;
    medianPercent: number;
    lessonsDone: number;
    /** People who actually finished something, not people holding a seat. */
    activeLearners: number;
  };
  distribution: ProgressBand[];
  series: ProgressPoint[];
}

/* ------------------------------------------------------------------ */
/*  Calls                                                              */
/* ------------------------------------------------------------------ */

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }

  const body = (await res.json()) as { data: T };
  return body.data;
}

function days(n?: number): string {
  return n === undefined ? "" : `?days=${Math.max(1, Math.min(n, 365))}`;
}

/** The administrator's four views. */
export const adminProgress = {
  cohort: (window?: number) => get<CohortProgress>(`/api/admin/progress${days(window)}`),

  course: (slug: string, window?: number) =>
    get<CourseCohortProgress>(
      `/api/admin/progress/courses/${encodeURIComponent(slug)}${days(window)}`,
    ),

  learner: (id: string, window?: number) =>
    get<LearnerProgress>(`/api/admin/progress/learners/${encodeURIComponent(id)}${days(window)}`),

  learnerInCourse: (slug: string, id: string, window?: number) =>
    get<LearnerCourseProgressResult>(
      `/api/admin/progress/courses/${encodeURIComponent(slug)}/learners/${encodeURIComponent(id)}${days(window)}`,
    ),
};

/**
 * The learner's own two views.
 *
 * The same figures their administrator sees, deliberately: somebody being
 * chased about mandatory training should be able to see what is outstanding,
 * and see the same numbers.
 */
export const myProgress = {
  all: (window?: number) => get<LearnerProgress>(`/api/me/progress${days(window)}`),

  course: (slug: string, window?: number) =>
    get<LearnerCourseProgressResult>(
      `/api/me/courses/${encodeURIComponent(slug)}/progress${days(window)}`,
    ),
};
