import { describe, it, expect } from "vitest";
import {
  countBlanks,
  alignBlanks,
  emptyQuestion,
  questionForType,
  quizQuestionIssue,
  contentForType,
  type QuizQuestion,
} from "./curriculum";

/**
 * The curriculum editor's pure logic. These functions decide whether a quiz an
 * instructor authored is answerable at all, the backend's QuizNormalizer
 * silently drops any question it cannot grade, so a gap here shows up as a
 * lesson that quietly loses its questions on save.
 */

describe("countBlanks", () => {
  it("counts each ___ run in the prompt", () => {
    expect(countBlanks("The ___ brown ___ jumps")).toBe(2);
  });

  it("treats a longer underscore run as one blank", () => {
    expect(countBlanks("Fill this _______ in")).toBe(1);
  });

  it("ignores runs shorter than three underscores", () => {
    expect(countBlanks("a __ b _ c")).toBe(0);
  });

  it("returns 0 for a prompt with no blanks", () => {
    expect(countBlanks("No blanks here")).toBe(0);
  });

  /** The pattern is a module-level /g regex, so a stale lastIndex would make
      repeated calls disagree. This is the guard against that. */
  it("is stable across repeated calls", () => {
    const prompt = "One ___ two ___";
    expect(countBlanks(prompt)).toBe(2);
    expect(countBlanks(prompt)).toBe(2);
    expect(countBlanks(prompt)).toBe(2);
  });
});

describe("alignBlanks", () => {
  it("grows the array when the author adds a blank", () => {
    const result = alignBlanks("a ___ b ___", [{ accepted: ["first"] }]);

    expect(result).toHaveLength(2);
    expect(result[0].accepted).toEqual(["first"]);
    expect(result[1].accepted).toEqual([""]);
  });

  it("shrinks it when they delete one, keeping the earlier answers", () => {
    const result = alignBlanks("a ___", [{ accepted: ["keep"] }, { accepted: ["drop"] }]);

    expect(result).toHaveLength(1);
    expect(result[0].accepted).toEqual(["keep"]);
  });

  it("empties the array when every blank is removed", () => {
    expect(alignBlanks("no blanks", [{ accepted: ["x"] }])).toEqual([]);
  });
});

describe("questionForType", () => {
  it("keeps the prompt and points when switching type", () => {
    const original: QuizQuestion = {
      ...emptyQuestion("multiple_choice"),
      prompt: "What is 2 + 2?",
      points: 5,
    };

    const switched = questionForType("short_answer", original);

    expect(switched.type).toBe("short_answer");
    expect(switched.prompt).toBe("What is 2 + 2?");
    expect(switched.points).toBe(5);
    expect(switched.id).toBe(original.id);
  });

  it("clamps a now-out-of-range correct answer index", () => {
    const original: QuizQuestion = {
      ...emptyQuestion("multiple_choice"),
      options: ["a", "b", "c", "d"],
      answer: 3,
    };

    // Switching away and back must not leave `answer` pointing past the end.
    const rebuilt = questionForType("multiple_choice", { ...original, options: ["a", "b"] });

    expect(rebuilt.answer).toBe(1);
  });

  it("rebuilds blanks from the prompt when switching to fill_blank", () => {
    const original: QuizQuestion = {
      ...emptyQuestion("multiple_choice"),
      prompt: "The ___ sat on the ___",
    };

    expect(questionForType("fill_blank", original).blanks).toHaveLength(2);
  });
});

describe("quizQuestionIssue", () => {
  it("rejects a question with no prompt", () => {
    expect(quizQuestionIssue(emptyQuestion("multiple_choice"))).toBe("Add a prompt.");
  });

  it("rejects multiple choice with fewer than two real options", () => {
    const q: QuizQuestion = {
      ...emptyQuestion("multiple_choice"),
      prompt: "Pick one",
      options: ["only", "  "],
    };

    expect(quizQuestionIssue(q)).toBe("Add at least two options.");
  });

  it("rejects multiple choice whose correct option is blank", () => {
    const q: QuizQuestion = {
      ...emptyQuestion("multiple_choice"),
      prompt: "Pick one",
      options: ["", "b", "c"],
      answer: 0,
    };

    expect(quizQuestionIssue(q)).toBe("Mark a non-empty option as correct.");
  });

  it("accepts a complete multiple choice question", () => {
    const q: QuizQuestion = {
      ...emptyQuestion("multiple_choice"),
      prompt: "Pick one",
      options: ["a", "b"],
      answer: 1,
    };

    expect(quizQuestionIssue(q)).toBeNull();
  });

  it("tells the author how to create a blank when they forgot", () => {
    const q: QuizQuestion = { ...emptyQuestion("fill_blank"), prompt: "No blank marker here" };

    expect(quizQuestionIssue(q)).toBe("Type ___ in the prompt to create a blank.");
  });

  it("rejects a blank with no accepted answer", () => {
    const q: QuizQuestion = {
      ...emptyQuestion("fill_blank"),
      prompt: "The ___ sat",
      blanks: [{ accepted: ["  "] }],
    };

    expect(quizQuestionIssue(q)).toBe("Every blank needs at least one accepted answer.");
  });

  it("rejects matching with fewer than two complete pairs", () => {
    const q: QuizQuestion = {
      ...emptyQuestion("matching"),
      prompt: "Match these",
      pairs: [
        { left: "a", right: "1" },
        { left: "b", right: "" },
      ],
    };

    expect(quizQuestionIssue(q)).toBe("Add at least two complete pairs.");
  });

  it("accepts matching with two complete pairs", () => {
    const q: QuizQuestion = {
      ...emptyQuestion("matching"),
      prompt: "Match these",
      pairs: [
        { left: "a", right: "1" },
        { left: "b", right: "2" },
      ],
    };

    expect(quizQuestionIssue(q)).toBeNull();
  });
});

describe("contentForType", () => {
  it("gives a video lecture a link source by default", () => {
    expect(contentForType("video")).toMatchObject({ source: "link", url: "" });
  });

  it("gives an article empty html rather than undefined", () => {
    expect(contentForType("article")).toMatchObject({ html: "" });
  });

  it("starts a quiz with one question so the editor is never blank", () => {
    const content = contentForType("quiz");
    expect(content.questions).toHaveLength(1);
  });
});
