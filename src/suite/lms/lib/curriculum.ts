/* ------------------------------------------------------------------ */
/*  Shared curriculum authoring types + helpers.                       */
/*  Used by the course-create wizard, the instructor course editor and  */
/*  the admin course editor.                                            */
/* ------------------------------------------------------------------ */

/**
 * `document` has existed on the API since the media library was built and was
 * missing from this union, so a PDF could not be attached to a lesson at all.
 * Institutions worked around it by pasting Drive links into article HTML —
 * which puts the file outside the library and outside the platform-only rule.
 */
export type LectureType = "video" | "article" | "document" | "quiz";

export type QuizQuestionType =
  | "multiple_choice"
  | "fill_blank"
  | "short_answer"
  | "matching";

export const QUIZ_QUESTION_TYPES: { value: QuizQuestionType; label: string; hint: string }[] = [
  {
    value: "multiple_choice",
    label: "Multiple choice",
    hint: "One prompt, several options, exactly one correct answer.",
  },
  {
    value: "fill_blank",
    label: "Fill in the blank",
    hint: "Type ___ (three underscores) in the prompt wherever a blank should appear.",
  },
  {
    value: "short_answer",
    label: "Short answer",
    hint: "Free text, compared against the answers you accept.",
  },
  {
    value: "matching",
    label: "Matching",
    hint: "Learners pair each left-hand item with its right-hand match.",
  },
];

/** Matches the placeholder the backend counts (`/_{3,}/`). */
export const BLANK_PATTERN = /_{3,}/g;

export function countBlanks(prompt: string): number {
  return prompt.match(BLANK_PATTERN)?.length ?? 0;
}

export interface QuizBlank {
  /** Any one of these counts as correct for this blank. */
  accepted: string[];
}

export interface QuizPair {
  left: string;
  right: string;
}

/**
 * One authored question. Only the fields relevant to `type` are meaningful; the
 * backend whitelists the rest away on save.
 */
export interface QuizQuestion {
  id?: string;
  type: QuizQuestionType;
  prompt: string;
  points?: number;
  explanation?: string | null;

  /** multiple_choice */
  options?: string[];
  answer?: number;

  /** fill_blank — one entry per `___` in the prompt */
  blanks?: QuizBlank[];

  /** short_answer */
  acceptedAnswers?: string[];

  /** fill_blank + short_answer */
  caseSensitive?: boolean;

  /** matching */
  pairs?: QuizPair[];
}

/**
 * Flat, type-keyed content bag persisted as JSON on the lecture. Only the keys
 * relevant to the lecture's `type` are meaningful:
 *   video   -> { source, url, provider?, publicId? }
 *   article -> { html }
 *   quiz    -> { questions, settings }
 */
export interface LectureContent {
  source?: "link" | "upload";
  url?: string;
  provider?: string | null;
  publicId?: string | null;
  html?: string;
  /** A reference into the media library; null on a pasted link or a legacy row. */
  mediaAssetId?: string | null;
  /** Shown to a learner before they open a document. */
  note?: string;
  questions?: QuizQuestion[];
  settings?: QuizSettings;
}

/**
 * How a quiz is sat, as opposed to what it asks.
 *
 * Every default is what quizzes already did before any of this existed, so a
 * lecture authored last year reads back identically: 70% to pass, unlimited
 * tries, no clock, every question in the order they were written.
 */
export interface QuizSettings {
  passMark?: number;
  /** Null or absent means unlimited. */
  maxAttempts?: number | null;
  /** Null or absent means untimed. */
  timeLimitMinutes?: number | null;
  /** Fewer than the bank holds is what makes it a bank. */
  questionsToAsk?: number | null;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
}

export interface Lecture {
  title: string;
  type: LectureType;
  duration?: string;
  content?: LectureContent | null;
}

export interface Section {
  title: string;
  lectures: Lecture[];
}

/* ------------------------------------------------------------------ */
/*  Factories                                                          */
/* ------------------------------------------------------------------ */

let questionSeq = 0;

/** Client-side id, used as a React key and as the grading payload key. */
function questionId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  questionSeq += 1;
  return `q-${questionSeq}`;
}

export function emptyQuestion(type: QuizQuestionType = "multiple_choice"): QuizQuestion {
  const base = { id: questionId(), type, prompt: "", points: 1 };
  switch (type) {
    case "multiple_choice":
      return { ...base, options: ["", ""], answer: 0 };
    case "fill_blank":
      return { ...base, blanks: [], caseSensitive: false };
    case "short_answer":
      return { ...base, acceptedAnswers: [""], caseSensitive: false };
    case "matching":
      return { ...base, pairs: [{ left: "", right: "" }, { left: "", right: "" }] };
  }
}

/** Keep whatever the author already typed when they switch a question's type. */
export function questionForType(type: QuizQuestionType, q: QuizQuestion): QuizQuestion {
  const next = emptyQuestion(type);
  next.id = q.id ?? next.id;
  next.prompt = q.prompt;
  next.points = q.points ?? 1;
  next.explanation = q.explanation ?? null;

  switch (type) {
    case "multiple_choice":
      next.options = q.options?.length ? q.options : ["", ""];
      next.answer = Math.min(q.answer ?? 0, Math.max(0, next.options.length - 1));
      break;
    case "fill_blank":
      next.blanks = alignBlanks(q.prompt, q.blanks ?? []);
      next.caseSensitive = q.caseSensitive ?? false;
      break;
    case "short_answer":
      next.acceptedAnswers = q.acceptedAnswers?.length ? q.acceptedAnswers : [""];
      next.caseSensitive = q.caseSensitive ?? false;
      break;
    case "matching":
      next.pairs = q.pairs?.length ? q.pairs : [{ left: "", right: "" }, { left: "", right: "" }];
      break;
  }
  return next;
}

/**
 * The prompt dictates how many blanks there are, so the editor grows and shrinks
 * the `blanks` array as the author types (or deletes) `___`.
 */
export function alignBlanks(prompt: string, blanks: QuizBlank[]): QuizBlank[] {
  const needed = countBlanks(prompt);
  const next = blanks.slice(0, needed);
  while (next.length < needed) next.push({ accepted: [""] });
  return next;
}

export function defaultContent(type: LectureType): LectureContent {
  switch (type) {
    case "video":
      return { source: "link", url: "" };
    case "article":
      return { html: "" };
    case "document":
      return { mediaAssetId: null, url: "", note: "" };
    case "quiz":
      return { questions: [emptyQuestion("multiple_choice")] };
  }
}

export function emptyLecture(type: LectureType = "video"): Lecture {
  return { title: "", type, duration: "", content: defaultContent(type) };
}

export function emptySection(): Section {
  return { title: "", lectures: [] };
}

/* ------------------------------------------------------------------ */
/*  Normalisation                                                      */
/* ------------------------------------------------------------------ */

/** Lectures keep the content shape that matches their current type. */
export function contentForType(type: LectureType, content?: LectureContent | null): LectureContent {
  const base = defaultContent(type);
  if (!content) return base;

  switch (type) {
    case "video":
      return {
        source: content.source ?? "link",
        // The reference into the media library. Everything beside it is kept
        // for lectures recorded before the library existed — the resolver
        // prefers the asset when there is one.
        mediaAssetId: content.mediaAssetId ?? null,
        url: content.url ?? "",
        provider: content.provider ?? null,
        publicId: content.publicId ?? null,
      };
    case "article":
      return { html: content.html ?? "" };
    case "document":
      return {
        mediaAssetId: content.mediaAssetId ?? null,
        url: content.url ?? "",
        // What a learner is told before they open it. A 40 MB download on a
        // phone deserves a warning.
        note: content.note ?? "",
      };
    case "quiz":
      return {
        questions:
          content.questions && content.questions.length > 0
            ? content.questions.map(hydrateQuestion)
            : base.questions,
      };
  }
}

/**
 * Questions authored before typed quizzes existed carry no `type` — they were
 * always single-answer multiple choice. Mirrors QuizQuestionType::fromLegacy().
 */
function hydrateQuestion(q: QuizQuestion): QuizQuestion {
  const type: QuizQuestionType =
    q.type && QUIZ_QUESTION_TYPES.some((t) => t.value === q.type) ? q.type : "multiple_choice";

  return {
    ...q,
    id: q.id ?? questionId(),
    type,
    prompt: q.prompt ?? "",
    points: q.points ?? 1,
    ...(type === "fill_blank" ? { blanks: alignBlanks(q.prompt ?? "", q.blanks ?? []) } : {}),
  };
}

/** Drop empty sections/lectures and produce the API payload. */
export function serializeSections(sections: Section[]): Section[] {
  return sections
    .filter((s) => s.title.trim())
    .map((s) => ({
      title: s.title.trim(),
      lectures: s.lectures
        .filter((l) => l.title.trim())
        .map((l) => ({
          title: l.title.trim(),
          type: l.type,
          duration: l.duration?.trim() || undefined,
          content: serializeContent(l.type, contentForType(l.type, l.content)),
        })),
    }));
}

function serializeContent(type: LectureType, content: LectureContent): LectureContent {
  if (type !== "quiz") return content;
  return { questions: (content.questions ?? []).map(serializeQuestion) };
}

/** Send only the keys the question's type actually uses. */
function serializeQuestion(q: QuizQuestion): QuizQuestion {
  const base = {
    id: q.id,
    type: q.type,
    prompt: q.prompt.trim(),
    points: q.points ?? 1,
    explanation: q.explanation?.trim() || null,
  };

  switch (q.type) {
    case "multiple_choice":
      return { ...base, options: (q.options ?? []).map((o) => o.trim()), answer: q.answer ?? 0 };
    case "fill_blank":
      return {
        ...base,
        blanks: alignBlanks(base.prompt, q.blanks ?? []).map((b) => ({
          accepted: b.accepted.map((a) => a.trim()).filter(Boolean),
        })),
        caseSensitive: q.caseSensitive ?? false,
      };
    case "short_answer":
      return {
        ...base,
        acceptedAnswers: (q.acceptedAnswers ?? []).map((a) => a.trim()).filter(Boolean),
        caseSensitive: q.caseSensitive ?? false,
      };
    case "matching":
      return {
        ...base,
        pairs: (q.pairs ?? [])
          .map((p) => ({ left: p.left.trim(), right: p.right.trim() }))
          .filter((p) => p.left && p.right),
      };
  }
}

/** Map a course-detail API response's sections into editable curriculum state. */
export function apiSectionsToCurriculum(
  sections:
    | {
        title: string;
        lectures?: {
          title: string;
          duration?: string | null;
          type: string;
          content?: LectureContent | null;
        }[];
      }[]
    | null
    | undefined,
): Section[] {
  if (!sections || sections.length === 0) return [emptySection()];
  return sections.map((s) => ({
    title: s.title,
    lectures: (s.lectures ?? []).map((l) => {
      const type = (["video", "article", "quiz"].includes(l.type) ? l.type : "video") as LectureType;
      return {
        title: l.title,
        type,
        duration: l.duration ?? "",
        content: contentForType(type, l.content),
      };
    }),
  }));
}

/* ------------------------------------------------------------------ */
/*  Authoring validation                                               */
/* ------------------------------------------------------------------ */

/**
 * Why the backend would drop this question, or null if it will survive the save.
 * Surfaced inline in the editor so an author never silently loses a question.
 */
export function quizQuestionIssue(q: QuizQuestion): string | null {
  if (!q.prompt.trim()) return "Add a prompt.";

  switch (q.type) {
    case "multiple_choice": {
      const filled = (q.options ?? []).filter((o) => o.trim());
      if (filled.length < 2) return "Add at least two options.";
      if (!(q.options ?? [])[q.answer ?? 0]?.trim()) return "Mark a non-empty option as correct.";
      return null;
    }
    case "fill_blank": {
      const blanks = countBlanks(q.prompt);
      if (blanks < 1) return "Type ___ in the prompt to create a blank.";
      const anyEmpty = (q.blanks ?? []).some((b) => !b.accepted.some((a) => a.trim()));
      if (anyEmpty || (q.blanks ?? []).length < blanks) {
        return "Every blank needs at least one accepted answer.";
      }
      return null;
    }
    case "short_answer":
      return (q.acceptedAnswers ?? []).some((a) => a.trim())
        ? null
        : "Add at least one accepted answer.";
    case "matching": {
      const complete = (q.pairs ?? []).filter((p) => p.left.trim() && p.right.trim());
      return complete.length < 2 ? "Add at least two complete pairs." : null;
    }
  }
}
