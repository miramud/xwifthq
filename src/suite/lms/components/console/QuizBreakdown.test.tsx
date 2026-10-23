import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import QuizBreakdown from "./QuizBreakdown";
import type {
  CourseQuizReport,
  QuizQuestionStats,
} from "@/lib/api/instructor-client";

/**
 * Which questions people get wrong, and what they answer instead.
 *
 * A course average tells an author the quiz is hard. This tells them *question
 * four* is hard, and the wrong answers underneath usually say why.
 *
 * The tests are almost entirely about the screen refusing to mislead, because
 * every way this goes wrong sends somebody off to rewrite a question that was
 * fine:
 *
 * - a blank is not a wrong answer
 * - a rate off three attempts is not a finding
 * - an edited quiz is said to have been edited, not quietly short of answers
 */

const { courseQuizzes } = vi.hoisted(() => ({ courseQuizzes: vi.fn() }));

vi.mock("@/lib/api/instructor-client", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/api/instructor-client")>();

  return { ...actual, insights: { courseQuizzes } };
});

const QUESTION: QuizQuestionStats = {
  id: "q-1",
  position: 0,
  prompt: "Capital of France?",
  type: "multiple_choice",
  typeLabel: "Multiple choice",
  answers: 40,
  attempted: 40,
  skipped: 0,
  correct: 34,
  correctRate: 85,
  skipRate: 0,
  isReliable: true,
  commonWrongAnswers: [],
};

function give(overrides: Partial<CourseQuizReport["quizzes"][0]> = {}) {
  courseQuizzes.mockResolvedValue({
    courseSlug: "fire-safety",
    courseTitle: "Fire Safety",
    totals: { quizzes: 1, attempts: 40 },
    quizzes: [
      {
        lectureId: "l-1",
        title: "Checkpoint",
        attempts: 40,
        averagePercentage: 78,
        passRate: 80,
        questionCount: 1,
        answersToRemovedQuestions: 0,
        questions: [QUESTION],
        ...overrides,
      },
    ],
  } satisfies CourseQuizReport);
}

beforeEach(() => {
  vi.clearAllMocks();
  give();
});

describe("the quiz header", () => {
  it("reports attempts, average and pass rate together", async () => {
    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(
      await screen.findByText("40 attempts · 78% average · 80% pass"),
    ).toBeInTheDocument();
  });

  it("says nobody has taken it rather than showing zeroes", async () => {
    give({ attempts: 0, averagePercentage: null, passRate: null, questions: [] });

    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(await screen.findByText("Nobody has taken this yet.")).toBeInTheDocument();
  });
});

describe("a question people get wrong", () => {
  it("names the wrong answers they actually gave", async () => {
    give({
      questions: [
        {
          ...QUESTION,
          correct: 10,
          correctRate: 25,
          commonWrongAnswers: [
            { value: "2", label: "Rome", count: 24, shareOfWrong: 80 },
            { value: "0", label: "London", count: 6, shareOfWrong: 20 },
          ],
        },
      ],
    });

    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(await screen.findByText("Rome")).toBeInTheDocument();
    expect(
      screen.getByText("24 (80% of wrong answers)"),
    ).toBeInTheDocument();
  });

  /*
    The interpretation is the useful part. Everybody converging on one wrong
    option is usually a question with two defensible readings, and an author
    told only "25% right" will rewrite the wrong thing.
  */
  it("warns about struggling questions and says what to look at first", async () => {
    give({
      questions: [{ ...QUESTION, correct: 10, correctRate: 25 }],
    });

    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(
      await screen.findByText(/1 question is getting fewer than half right/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/two defensible readings/),
    ).toBeInTheDocument();
  });

  it("does not warn about a question most people get right", async () => {
    render(<QuizBreakdown courseSlug="fire-safety" />);

    await screen.findByText("Capital of France?");

    expect(
      screen.queryByText(/getting fewer than half right/),
    ).not.toBeInTheDocument();
  });
});

describe("blanks", () => {
  /*
    The distinction that would otherwise be quietly lost. A question half the
    cohort never reached is a pacing problem; reporting it as a low correct
    rate sends the author after a question that was fine.
  */
  it("counts a blank separately from a wrong answer", async () => {
    give({
      questions: [
        {
          ...QUESTION,
          answers: 40,
          attempted: 20,
          skipped: 20,
          correct: 20,
          correctRate: 100,
          skipRate: 50,
        },
      ],
    });

    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(await screen.findByText("100% right")).toBeInTheDocument();
    expect(
      screen.getByText(/Multiple choice · 20 answered · 20 left it blank/),
    ).toBeInTheDocument();
  });

  it("says a heavily skipped question is probably unclear, not hard", async () => {
    give({
      questions: [
        { ...QUESTION, attempted: 20, skipped: 20, correctRate: 100, skipRate: 50 },
      ],
    });

    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(
      await screen.findByText(/50% left this blank/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/unclear or too far into the quiz, rather than too hard/),
    ).toBeInTheDocument();
  });

  it("says nobody reached it rather than showing zero percent", async () => {
    give({
      questions: [
        {
          ...QUESTION,
          attempted: 0,
          skipped: 40,
          correct: 0,
          correctRate: null,
          skipRate: 100,
        },
      ],
    });

    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(await screen.findByText("Nobody reached it")).toBeInTheDocument();
    expect(screen.queryByText("0% right")).not.toBeInTheDocument();
  });
});

describe("thin data", () => {
  /* 50% off two attempts is noise, and must not read like a finding. */
  it("says when there are too few answers to read anything into", async () => {
    give({
      attempts: 2,
      questions: [
        {
          ...QUESTION,
          answers: 2,
          attempted: 2,
          correct: 1,
          correctRate: 50,
          isReliable: false,
        },
      ],
    });

    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(
      await screen.findByText(/Only 2 answered so far, too few to read anything into/),
    ).toBeInTheDocument();
  });

  it("does not count an unreliable question towards the warning", async () => {
    give({
      questions: [
        { ...QUESTION, correct: 1, correctRate: 25, isReliable: false },
      ],
    });

    render(<QuizBreakdown courseSlug="fire-safety" />);

    await screen.findByText("Capital of France?");

    expect(
      screen.queryByText(/getting fewer than half right/),
    ).not.toBeInTheDocument();
  });
});

describe("an edited quiz", () => {
  /*
    Otherwise the attempt count and the answer counts disagree and the reader
    assumes the report is broken.
  */
  it("explains answers to questions that have been edited out", async () => {
    give({ answersToRemovedQuestions: 12 });

    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(
      await screen.findByText(/12 earlier answers were to questions that have since been edited out/),
    ).toBeInTheDocument();
  });

  it("says nothing when the quiz has not been edited", async () => {
    render(<QuizBreakdown courseSlug="fire-safety" />);

    await screen.findByText("Capital of France?");

    expect(screen.queryByText(/edited out/)).not.toBeInTheDocument();
  });
});

describe("when there are no quizzes", () => {
  it("says so rather than rendering an empty card", async () => {
    courseQuizzes.mockResolvedValue({
      courseSlug: "fire-safety",
      courseTitle: "Fire Safety",
      quizzes: [],
      totals: { quizzes: 0, attempts: 0 },
    } satisfies CourseQuizReport);

    render(<QuizBreakdown courseSlug="fire-safety" />);

    expect(
      await screen.findByText("No quizzes in this course"),
    ).toBeInTheDocument();
  });
});
