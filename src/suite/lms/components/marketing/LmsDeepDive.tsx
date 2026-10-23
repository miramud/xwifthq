import { Check } from "lucide-react";
import {
  CertificateFigure,
  CourseBuilderFigure,
  GamificationFigure,
  PathwayLadderFigure,
} from "@/suite/lms/components/marketing/LmsVisuals";

/**
 * The four blocks that carry the XwiftHQ Learning page.
 *
 * Framed for a company training its own staff (owner, 9 Oct 2026). Every
 * claim was checked against what the module does; where it does something
 * narrower than it sounds, the narrower thing is what the copy says.
 *
 * Each block is a numbered lilac pill, a bold title, the copy and a list of
 * purple check circles, beside its drawing on a lilac wash.
 */

interface Block {
  /** Short pill label above the title. */
  eyebrow: string;
  title: string;
  paragraphs: string[];
  points: string[];
  figure: React.ReactNode;
}

const BLOCKS: Block[] = [
  {
    eyebrow: "Learning paths",
    title: "Learning paths that start with the job",
    paragraphs: [
      "A learning path is an ordered set of courses: induction, the tools of a role, the policies everyone signs up to. Assign it in one action to a person, a team or the whole company. Progress is measured against the path, so everyone knows which step they're on.",
      "The suite shares one employee record, so a new hire's onboarding checklist in HRM can include their induction courses. Start on Monday, get your training on Monday. No waiting for a manager to remember which six courses the role needs.",
    ],
    points: [
      "Ordered paths built from published courses",
      "Assign to one person, a team or everyone at once",
      "A roster showing who has started, stalled or finished",
      "Induction courses linked to HRM onboarding steps",
      "Withdraw an assignment and the progress made so far is kept",
    ],
    figure: <PathwayLadderFigure />,
  },
  {
    eyebrow: "Course builder",
    title: "Courses your own experts can write",
    paragraphs: [
      "A course is made of sections and lessons. Each lesson is a video, an article, a document or a quiz, in any order you like. Video and files come from your organisation's media library, either uploaded or connected from Cloudinary, Google Drive or S3.",
      "Quizzes support multiple choice, fill the blank, short answer and matching questions, with a pass mark, attempt limits, a time limit and a shuffled question bank when you want one. Marking runs on the server, so the answer key never reaches the browser. The question report shows which ones people get wrong.",
    ],
    points: [
      "Video, article, document and quiz lessons in any mix",
      "Pass marks, attempt limits, time limits and question banks",
      "Results for every question, plus where people stop watching",
      "Draft, review and published states, under your own approval policy",
      "Your logo and colours on the learning pages",
    ],
    figure: <CourseBuilderFigure />,
  },
  {
    eyebrow: "Compliance",
    title: "Compliance training you can prove",
    paragraphs: [
      "Mark any assignment mandatory and give it a due date. The compliance report shows who is complete, due or overdue, and exports to CSV for whoever asks. It also shows on the person's HRM record, where their manager sees it at appraisal.",
      "Finish a course and a serialised certificate is issued in the same step. For training that has to be repeated (fire safety every year, data protection every two), the certificate expires on schedule and the requirement reopens from that date. No renewal spreadsheet required.",
    ],
    points: [
      "Mandatory assignments with due dates and an overdue list",
      "Compliance report with CSV export",
      "Expiring certificates for training that has to recur",
      "Public lookup at /verify by serial, no account needed",
      "Revoke or reinstate, and the lookup updates immediately",
    ],
    figure: <CertificateFigure />,
  },
  {
    eyebrow: "Badges and boards",
    title: "Visible progress, kept inside your company",
    paragraphs: [
      "Badges land at every quarter of a course (25, 50, 75 and 100 per cent) and for finishing a path, so the next one is always close. Once earned, a badge is never taken back.",
      "Leaderboards are scoped to your organisation. Colleagues push each other on. Strangers don't need to see who finished what, and nobody outside the company ever appears on your board.",
    ],
    points: [
      "Quarter badges at 25, 50, 75 and 100 per cent of a course",
      "Path badges for finishing an assigned path",
      "Leaderboards visible only inside your organisation",
      "Your own row pinned to the board, even below the cut",
      "Completion, ratings and engagement reports for managers",
    ],
    figure: <GamificationFigure />,
  },
];

export function LmsDeepDive() {
  return (
    <div className="space-y-20 lg:space-y-28">
      {BLOCKS.map((block, index) => {
        const figureFirst = index % 2 === 1;

        return (
          <div
            key={block.title}
            className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16"
          >
            <div className={`min-w-0 ${figureFirst ? "lg:order-2" : ""}`}>
              <p className="xw-eyebrow">
                <span className="tnum">{String(index + 1).padStart(2, "0")}</span>
                <span className="h-1 w-1 rounded-full bg-primary-400" aria-hidden="true" />
                {block.eyebrow}
              </p>
              <h3 className="mt-4 font-heading text-2xl font-bold leading-snug tracking-[-0.02em] text-neutral-900 sm:text-[1.75rem]">
                {block.title}
              </h3>

              {block.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-4 max-w-prose leading-relaxed text-neutral-600"
                >
                  {paragraph}
                </p>
              ))}

              <ul className="mt-7 space-y-3">
                {block.points.map((point) => (
                  <li key={point} className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100"
                      aria-hidden="true"
                    >
                      <Check className="h-3 w-3 text-primary-700" />
                    </span>
                    <span className="text-sm leading-relaxed text-neutral-700">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/*
              Each drawing sits on a lilac wash panel, the way the home page's
              three steps set the workspace glimpse on colour.
            */}
            <div
              className={`min-w-0 rounded-[1.25rem] bg-gradient-to-br from-primary-100 via-primary-50 to-white p-4 sm:p-8 ${
                figureFirst ? "lg:order-1" : ""
              }`}
            >
              {block.figure}
            </div>
          </div>
        );
      })}
    </div>
  );
}
