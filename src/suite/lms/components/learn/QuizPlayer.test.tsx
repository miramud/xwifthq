import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import QuizPlayer from "./QuizPlayer";
import { ApiError, type QuizSitting } from "@/lib/api/learn-client";

/**
 * Sitting a quiz that rations something.
 *
 * The questions now come from *opening* the quiz rather than with the course,
 * which is what makes a clock, an attempt limit and a question bank possible
 * at all — and what stops a refresh being a way to reroll the bank or restart
 * the timer.
 *
 * The tests are about being fair and being honest with a learner:
 *
 * - what the quiz costs is said before they start, not discovered by running
 *   out
 * - the countdown submits what they have rather than discarding it, so
 *   somebody who ran out on the last question is still marked on the nine
 *   they did
 * - a used-up last attempt is stated, not shown as a button that will be
 *   refused
 */

const { startQuiz, gradeQuiz } = vi.hoisted(() => ({
  startQuiz: vi.fn(),
  gradeQuiz: vi.fn(),
}));

vi.mock("@/lib/api/learn-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/learn-client")>();

  return { ...actual, startQuiz, gradeQuiz };
});

const QUESTION = {
  id: "q-1",
  type: "multiple_choice" as const,
  prompt: "Capital of France?",
  points: 1,
  options: ["London", "Paris", "Rome"],
};

function sitting(overrides: Partial<QuizSitting> = {}): QuizSitting {
  return {
    sessionId: "s-1",
    questions: [QUESTION],
    expiresAt: null,
    passMark: 70,
    used: 0,
    remaining: null,
    passed: false,
    mayAttempt: true,
    ...overrides,
  };
}

function play() {
  return render(
    <QuizPlayer
      courseSlug="fire-safety"
      lectureId="l-1"
      title="Checkpoint"
      onComplete={vi.fn()}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  startQuiz.mockResolvedValue(sitting());
});

afterEach(() => {
  vi.useRealTimers();
});

describe("opening the quiz", () => {
  /* The questions no longer arrive with the course. */
  it("asks the server for a sitting and shows what it returns", async () => {
    play();

    expect(await screen.findByText("Capital of France?")).toBeInTheDocument();
    expect(startQuiz).toHaveBeenCalledWith("fire-safety", "l-1");
  });

  it("says so while it is opening rather than showing an empty quiz", async () => {
    play();

    expect(screen.getByText("Opening the quiz…")).toBeInTheDocument();
  });

  it("shows the pass mark before anything is answered", async () => {
    play();

    expect(await screen.findByText(/pass mark 70%/)).toBeInTheDocument();
  });

  /*
    Said before they start. Finding out how many tries you had by running out
    of them is the version of this that makes people distrust the software.
  */
  it("says how many tries are left when they are rationed", async () => {
    startQuiz.mockResolvedValue(sitting({ remaining: 2, used: 1 }));

    play();

    expect(await screen.findByText(/2 tries left/)).toBeInTheDocument();
  });

  it("says nothing about tries when they are unlimited", async () => {
    play();

    await screen.findByText("Capital of France?");

    expect(screen.queryByText(/tries left/)).not.toBeInTheDocument();
  });

  /*
    An `ApiError` carries something the server actually said, so it is shown.
    A bare network failure is not — "Failed to fetch" tells a learner nothing
    and reads as their mistake.
  */
  it("reports a refusal instead of an empty quiz", async () => {
    startQuiz.mockRejectedValue(
      new ApiError("You have used all 2 attempts.", 422),
    );

    play();

    expect(
      await screen.findByText("You have used all 2 attempts."),
    ).toBeInTheDocument();
  });
});

describe("submitting", () => {
  it("sends the sitting id, which the server requires", async () => {
    gradeQuiz.mockResolvedValue({
      score: 1,
      maxScore: 1,
      correctCount: 1,
      total: 1,
      percentage: 100,
      passed: true,
      passMark: 70,
      results: [],
    });

    play();

    await userEvent.click(await screen.findByText("Paris"));
    await userEvent.click(screen.getByRole("button", { name: /Submit/i }));

    await waitFor(() =>
      expect(gradeQuiz).toHaveBeenCalledWith(
        "fire-safety",
        "l-1",
        expect.anything(),
        "s-1",
      ),
    );
  });
});

describe("the clock", () => {
  it("counts down when the sitting is timed", async () => {
    startQuiz.mockResolvedValue(
      sitting({ expiresAt: new Date(Date.now() + 90_000).toISOString() }),
    );

    play();

    // 1:30, give or take the tick that runs on mount.
    expect(await screen.findByText(/^1:(29|30)$/)).toBeInTheDocument();
  });

  it("shows no clock on an untimed quiz", async () => {
    play();

    await screen.findByText("Capital of France?");

    expect(screen.queryByText(/^\d+:\d\d$/)).not.toBeInTheDocument();
  });

  /*
    Submits rather than discards. Somebody who ran out of time on the last
    question should still be marked on the nine they did.
  */
  it("submits what has been answered when the time runs out", async () => {
    gradeQuiz.mockResolvedValue({
      score: 0,
      maxScore: 1,
      correctCount: 0,
      total: 1,
      percentage: 0,
      passed: false,
      passMark: 70,
      results: [],
    });

    startQuiz.mockResolvedValue(
      sitting({ expiresAt: new Date(Date.now() - 1_000).toISOString() }),
    );

    play();

    await waitFor(() => expect(gradeQuiz).toHaveBeenCalled());
  });
});

describe("when the attempts are gone", () => {
  /* A button that will be refused is worse than no button. */
  it("says there is nothing left rather than offering a retry", async () => {
    gradeQuiz.mockResolvedValue({
      score: 0,
      maxScore: 1,
      correctCount: 0,
      total: 1,
      percentage: 0,
      passed: false,
      passMark: 70,
      results: [],
      used: 2,
      remaining: 0,
      mayAttempt: false,
    });

    startQuiz.mockResolvedValue(sitting({ remaining: 1 }));

    play();

    await userEvent.click(await screen.findByText("Paris"));
    await userEvent.click(screen.getByRole("button", { name: /Submit/i }));

    expect(await screen.findByText("No attempts left")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Retry/i }),
    ).not.toBeInTheDocument();
  });

  it("offers a retry, with the count, while tries remain", async () => {
    gradeQuiz.mockResolvedValue({
      score: 0,
      maxScore: 1,
      correctCount: 0,
      total: 1,
      percentage: 0,
      passed: false,
      passMark: 70,
      results: [],
      used: 1,
      remaining: 1,
      mayAttempt: true,
    });

    play();

    await userEvent.click(await screen.findByText("Paris"));
    await userEvent.click(screen.getByRole("button", { name: /Submit/i }));

    expect(
      await screen.findByRole("button", { name: /Retry \(1 left\)/i }),
    ).toBeInTheDocument();
  });

  /* A retry is a fresh sitting, or the bank would deal the same questions. */
  it("re-opens the quiz when retrying rather than reusing the sitting", async () => {
    gradeQuiz.mockResolvedValue({
      score: 0,
      maxScore: 1,
      correctCount: 0,
      total: 1,
      percentage: 0,
      passed: false,
      passMark: 70,
      results: [],
      mayAttempt: true,
      remaining: 1,
    });

    play();

    await userEvent.click(await screen.findByText("Paris"));
    await userEvent.click(screen.getByRole("button", { name: /Submit/i }));
    await userEvent.click(await screen.findByRole("button", { name: /Retry/i }));

    await waitFor(() => expect(startQuiz).toHaveBeenCalledTimes(2));
  });
});
