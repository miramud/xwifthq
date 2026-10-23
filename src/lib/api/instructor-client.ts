/* ------------------------------------------------------------------ */
/*  Browser-side client for the instructor-studio APIs.                */
/*  Calls the same-origin /api/instructor/* proxy.                     */
/* ------------------------------------------------------------------ */

import { ApiError } from "./admin-client";
export { ApiError };

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(`/api/instructor/${path}`, {
    method: init.method ?? "GET",
    headers: init.body ? { "Content-Type": "application/json" } : undefined,
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(json?.message ?? "Request failed.", res.status, json?.errors);
  }
  return json as T;
}

function data<T>(res: { data?: T }): T {
  return (res.data ?? []) as T;
}

/* ---------- Profile ---------- */

export interface InstructorProfile {
  id: string;
  name: string;
  initials: string;
  title: string | null;
  headline: string | null;
  bio: string | null;
  /** Read-only: the sign-in address. There is no verification or reset flow. */
  email: string | null;
  avatarUrl: string | null;
  avatarPublicId: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  status: string;
  rating: number;
  studentCount: number;
  courseCount: number;
  payoutMethod: string | null;
  bankName: string | null;
  bankAccountName: string | null;
  bankAccountNumber: string | null;
}

/** Exactly the fields the API accepts — `email` and the counters are not among them. */
export type InstructorProfileUpdate = Partial<
  Pick<
    InstructorProfile,
    | "name"
    | "title"
    | "headline"
    | "bio"
    | "phone"
    | "location"
    | "website"
    | "twitter"
    | "linkedin"
    | "avatarUrl"
    | "avatarPublicId"
    | "payoutMethod"
    | "bankName"
    | "bankAccountName"
    | "bankAccountNumber"
  >
>;

export const profile = {
  get: () => request<{ data: InstructorProfile }>("profile").then((r) => r.data),
  update: (body: InstructorProfileUpdate) =>
    request<{ data: InstructorProfile }>("profile", { method: "PATCH", body }).then((r) => r.data),
};

/* ---------- Courses ---------- */

export interface InstructorCourse {
  slug: string;
  title: string;
  category: string | null;
  level: string;
  students: number;
  /** Learners who finished it. Courses are free, so uptake replaced revenue. */
  completions: number;
  rating: number;
  reviews: number;
  lectures: number;
  status: string;
  gradient: string | null;
  thumbnailUrl: string | null;
  lastUpdated: string | null;
}

export const courses = {
  list: () => request<{ data: InstructorCourse[] }>("courses").then(data),
  get: (slug: string) => request<{ data: unknown }>(`courses/${slug}`).then((r) => r.data),
  create: (body: Record<string, unknown>) =>
    request<{ data: unknown }>("courses", { method: "POST", body }).then((r) => r.data),
  update: (slug: string, body: Record<string, unknown>) =>
    request<{ data: unknown }>(`courses/${slug}`, { method: "PATCH", body }).then((r) => r.data),
  remove: (slug: string) => request<unknown>(`courses/${slug}`, { method: "DELETE" }),
  setStatus: (slug: string, status: string) =>
    request<{ data: unknown }>(`courses/${slug}/status`, { method: "PATCH", body: { status } }).then((r) => r.data),
};

/* ---------- Certificate templates (read-only picker) ---------- */

export interface PickerCertificateTemplate {
  id: string;
  name: string;
  orgName: string;
  accentColor: string;
  isDefault: boolean;
}

export const certificateTemplates = {
  list: () =>
    request<{ data: PickerCertificateTemplate[] }>("certificate-templates").then(data),
};

/* ---------- Media uploads ---------- */

/**
 * Re-exported from the shared uploader so both the instructor studio and the
 * admin course editor hit the same role-agnostic /api/uploads endpoint.
 */
export { uploadMedia, uploadLectureVideo, type UploadResult, type MediaKind } from "./upload-client";

/* ---------- Announcements ---------- */

export interface Announcement {
  id: string;
  title: string;
  body: string;
  course: string;
  courseSlug: string | null;
  audience: string;
  recipients: number;
  sentOn: string;
  openRate?: number;
}

export const announcements = {
  list: () => request<{ data: Announcement[] }>("announcements").then(data),
  create: (body: { title: string; body: string; courseSlug?: string; audience?: string }) =>
    request<{ data: Announcement }>("announcements", { method: "POST", body }).then((r) => r.data),
  remove: (id: string) => request<unknown>(`announcements/${id}`, { method: "DELETE" }),
};

/* ---------- Reviews ---------- */

export interface InstructorReview {
  id: string;
  student: string;
  initials: string;
  rating: number;
  body: string;
  status: string;
  courseSlug: string | null;
  courseTitle: string | null;
  reply: string | null;
  replyDate: string | null;
  helpful: number;
  date: string;
}

export const reviews = {
  list: () => request<{ data: InstructorReview[] }>("reviews").then(data),
  reply: (id: string, body: string) =>
    request<{ data: InstructorReview }>(`reviews/${id}/reply`, { method: "POST", body: { reply: body } }).then((r) => r.data),
};

/* ---------- Analytics ---------- */

export interface InstructorMonth {
  month: string;
  fullMonth: string;
  enrollments: number;
  completions: number;
}

export interface InstructorOverview {
  totals: {
    learners: number;
    enrollments: number;
    completions: number;
    publishedCourses: number;
    totalCourses: number;
    reviews: number;
    avgRating: number;
    avgCompletion: number;
    completionRate: number;
    enrollmentsDelta: number;
    completionsDelta: number;
    ratingDelta: number;
    completionDelta: number;
  };
  monthly: InstructorMonth[];
  topCourses: {
    slug: string;
    title: string;
    category: string | null;
    learners: number;
    completions: number;
    completionRate: number;
    rating: number;
    gradient: string | null;
  }[];
}


export const analytics = {
  overview: () => request<{ data: InstructorOverview }>("analytics/overview").then((r) => r.data),
};


/* ---------- Learner roster ---------- */

export type LearnerStatus = "Active" | "Completed" | "At risk" | "Refunded" | "Cancelled";

export interface Learner {
  /** The enrollment id — the same person on two courses is two rows. */
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  initials: string;
  courseSlug: string | null;
  courseTitle: string | null;
  enrolledOn: string;
  lastActive: string;
  progress: number;
  lessonsDone: number;
  totalLessons: number;
  quizAvg: number | null;
  amountPaid: number;
  status: LearnerStatus;
}

export interface LearnerActivity {
  kind: "enroll" | "quiz" | "message" | "certificate";
  label: string;
  detail: string;
  at: string;
}

export interface LearnerDetail extends Omit<Learner, "userId"> {
  courseGradient: string | null;
  courseThumbnailUrl: string | null;
  sections: { title: string; lessons: number; completed: number; percent: number }[];
  quizzes: {
    lecture: string | null;
    score: number;
    maxScore: number;
    percentage: number;
    passed: boolean;
    takenAt: string;
  }[];
  activity: LearnerActivity[];
}

export const students = {
  list: (courseSlug?: string) =>
    request<{ data: Learner[] }>(`students${courseSlug ? `?courseSlug=${encodeURIComponent(courseSlug)}` : ""}`).then(data),
  get: (enrollmentId: string) =>
    request<{ data: LearnerDetail }>(`students/${enrollmentId}`).then((r) => r.data),
};

/* ---------- Engagement, ledger, to-dos ---------- */

export interface Engagement {
  totals: {
    views: number;
    uniqueVisitors: number;
    enrollments: number;
    conversionRate: number;
    avgQuizScore: number | null;
    /** Null until the first course view is recorded. */
    trackingSince: string | null;
  };
  trafficSources: { label: string; visitors: number; color: string }[];
  funnel: { label: string; value: number }[];
  topLessons: {
    lectureId: string;
    title: string;
    course: string;
    courseSlug: string;
    type: string;
    enrolled: number;
    completions: number;
    completionRate: number;
  }[];
  dropOffPoints: { lesson: string; course: string; lostLearners: number; dropOff: number }[];
}


export interface TodoItem {
  label: string;
  meta: string;
  href: string;
  urgent: boolean;
}

export interface CourseAnalytics {
  monthly: { month: string; fullMonth: string; enrollments: number; gross: number; net: number }[];
  totals: {
    students: number;
    gross: number;
    /** The admin-managed platform fee, already applied to `platformFee` and `net`. */
    feePercent: number;
    platformFee: number;
    net: number;
    views: number;
    uniqueVisitors: number;
    conversionRate: number;
    refunds: number;
    refundRate: number;
    avgCompletion: number;
    avgQuizScore: number | null;
  };
}


/* ---------- Quiz breakdown ---------- */

export interface QuizDistractor {
  /** The stored response, normalised. An index for multiple choice. */
  value: string;
  /** What the author recognises: the option's own text, not its index. */
  label: string;
  count: number;
  /** Share of the people who got it wrong, not of everybody. */
  shareOfWrong: number;
}

export interface QuizQuestionStats {
  id: string;
  position: number;
  prompt: string;
  type: string;
  typeLabel: string;
  /** Everybody who reached it, including those who left it blank. */
  answers: number;
  /** Those who actually put something down. */
  attempted: number;
  skipped: number;
  correct: number;
  /**
   * Out of those who attempted it, so a question half the cohort never
   * reached reads as a pacing problem rather than a comprehension one.
   * Null when nobody answered it at all — zero would say everybody failed.
   */
  correctRate: number | null;
  skipRate: number | null;
  /** Enough attempts for the rate to mean anything. */
  isReliable: boolean;
  commonWrongAnswers: QuizDistractor[];
}

export interface QuizStats {
  lectureId: string;
  title: string;
  attempts: number;
  averagePercentage: number | null;
  passRate: number | null;
  questionCount: number;
  /** Answers whose question has since been edited away. */
  answersToRemovedQuestions: number;
  questions: QuizQuestionStats[];
}

export interface CourseQuizReport {
  courseSlug: string;
  courseTitle: string;
  quizzes: QuizStats[];
  totals: { quizzes: number; attempts: number };
}

/* ---------- Engagement ---------- */

export interface VideoRetention {
  lectureId: string;
  title: string;
  /**
   * False for a YouTube or Vimeo embed, which plays in a cross-origin frame
   * the page cannot observe. Reported as unmeasurable rather than abandoned.
   */
  measurable: boolean;
  viewers: number;
  /** Null when nobody has watched it — never zero, which would be a claim. */
  medianPercent: number | null;
  isReliable: boolean;
  /** How many reached each tenth. Falls monotonically by construction. */
  retention: { atPercent: number; viewers: number; share: number }[];
  /** The stretch that loses the most people; null when nobody has watched. */
  biggestDrop: { fromPercent: number; toPercent: number; lost: number } | null;
  watchedToEnd: number;
}

export interface CourseEngagement {
  courseSlug: string;
  courseTitle: string;
  videos: VideoRetention[];
  timeToComplete: {
    finishers: number;
    /** Median, not mean: a long tail is the norm here. */
    medianDays: number | null;
    fastestDays: number | null;
    slowestDays: number | null;
    bands: { label: string; learners: number }[];
    /** Counted apart — they have not taken forever, they have not finished. */
    stillGoing: number;
  };
}

export const insights = {
  engagement: () => request<{ data: Engagement }>("analytics/engagement").then((r) => r.data),
  todos: () => request<{ data: TodoItem[] }>("todos").then(data),
  course: (slug: string) =>
    request<{ data: CourseAnalytics }>(`analytics/courses/${slug}`).then((r) => r.data),
  /** Which questions people get wrong, and what they answer instead. */
  courseQuizzes: (slug: string) =>
    request<{ data: CourseQuizReport }>(`analytics/courses/${slug}/quizzes`).then(
      (r) => r.data,
    ),
  /** Where people stop, and how long the course really takes. */
  courseEngagement: (slug: string) =>
    request<{ data: CourseEngagement }>(
      `analytics/courses/${slug}/engagement`,
    ).then((r) => r.data),
};

/* ---------- Course Q&A inbox ---------- */

export interface QuestionMessage {
  id: string;
  from: "student" | "instructor";
  authorRole: "student" | "instructor" | "admin";
  author: string | null;
  body: string;
  createdAt: string;
}

export interface Question {
  id: string;
  reference: string;
  subject: string;
  student: string | null;
  studentEmail: string | null;
  initials: string;
  courseSlug: string | null;
  courseTitle: string | null;
  lesson: string | null;
  preview: string;
  starred: boolean;
  resolved: boolean;
  /** The learner spoke last and the instructor has not opened it since. */
  awaitingReply: boolean;
  lastReplyAt: string;
  createdAt: string;
  messages?: QuestionMessage[];
}

export type QuestionFilter = "all" | "unread" | "starred" | "resolved";

export const questions = {
  list: (filter: QuestionFilter = "all") =>
    request<{ data: Question[] }>(`questions${filter === "all" ? "" : `?filter=${filter}`}`).then(data),
  unansweredCount: () =>
    request<{ data: { unanswered: number } }>("questions/unread-count").then((r) => r.data.unanswered),
  get: (id: string) => request<{ data: Question }>(`questions/${id}`).then((r) => r.data),
  reply: (id: string, body: string) =>
    request<{ data: Question }>(`questions/${id}/replies`, { method: "POST", body: { body } }).then((r) => r.data),
  update: (id: string, changes: { starred?: boolean; resolved?: boolean }) =>
    request<{ data: Question }>(`questions/${id}`, { method: "PATCH", body: changes }).then((r) => r.data),
};
