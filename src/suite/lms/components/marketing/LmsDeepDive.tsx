import { Check } from "lucide-react";
import {
  CertificateFigure,
  CourseBuilderFigure,
  GamificationFigure,
  PathwayLadderFigure,
} from "@/suite/lms/components/marketing/LmsVisuals";

/**
 * The four blocks that carry the Elevate Learning page.
 *
 * Framed for a company training its own staff (owner, 9 Oct 2026). Every
 * claim was checked against what the module does; where it does something
 * narrower than it sounds, the narrower thing is what the copy says.
 */

interface Block {
  title: string;
  paragraphs: string[];
  points: string[];
  figure: React.ReactNode;
}

const BLOCKS: Block[] = [
  {
    title: "Learning paths that arrive with the job",
    paragraphs: [
      "A learning path is an ordered set of courses — induction, the tools of a role, the policies everyone signs up to. It is assigned in one action to a person, a team or the whole company, and progress is measured against the path, so each person always knows which step they are on.",
      "Because the suite shares one employee record, a new hire's onboarding checklist in HRM can include their induction courses. Somebody who starts on Monday has their training on Monday, instead of waiting for a manager to remember which six courses the role needs.",
    ],
    points: [
      "Ordered paths built from published courses",
      "Assigned to one person, a team or everyone at once",
      "A roster of who has started, stalled and finished",
      "Induction courses linked to HRM onboarding steps",
      "Withdrawing an assignment keeps the progress already made",
    ],
    figure: <PathwayLadderFigure />,
  },
  {
    title: "Courses your own experts can write",
    paragraphs: [
      "A course is sections and lessons, and a lesson is a video, an article, a document or a quiz, mixed in any order. Video and files come from your organisation's media library — uploaded, or connected from Cloudinary, Google Drive or S3.",
      "Quizzes take multiple choice, fill the blank, short answer and matching questions, with a pass mark, attempt limits, a time limit and a shuffled question bank where you want one. Marking happens on the server, so the answer key never reaches the browser, and the question report shows which ones people get wrong.",
    ],
    points: [
      "Video, article, document and quiz lessons in any mix",
      "Pass marks, attempt limits, time limits and question banks",
      "Per-question results, and where people stop watching",
      "Draft, review and published states, with your own approval policy",
      "Your company's logo and colours on the learning pages",
    ],
    figure: <CourseBuilderFigure />,
  },
  {
    title: "Compliance training you can prove",
    paragraphs: [
      "Any assignment can be marked mandatory with a due date. The compliance report lists who is complete, who is due and who is overdue, and exports to CSV for whoever asks. It also appears on the person's record in HRM, where their manager will see it at appraisal.",
      "Finishing a course issues a certificate with a serial in the same step. If the training has to be repeated — fire safety every year, data protection every two — the certificate expires on schedule and the obligation reopens from that date, so nobody has to keep a renewal spreadsheet.",
    ],
    points: [
      "Mandatory assignments with due dates and an overdue list",
      "A compliance report with CSV export",
      "Certificates that expire, for training that has to recur",
      "Public lookup at /verify by serial, no account needed",
      "Revoke and reinstate, reflected in the lookup immediately",
    ],
    figure: <CertificateFigure />,
  },
  {
    title: "Progress people can see, inside your company only",
    paragraphs: [
      "Badges land at each quarter of a course — 25, 50, 75 and 100 per cent — and for finishing a path, so the next one is always close. A badge, once earned, is never taken back.",
      "Leaderboards are scoped to your own organisation. Colleagues motivate each other; strangers do not need to see who finished what, and nobody outside the company ever appears on your board.",
    ],
    points: [
      "Quarter badges at 25, 50, 75 and 100 per cent of a course",
      "Path badges for finishing an assigned path",
      "Leaderboards visible only inside your organisation",
      "Your own row pinned to the board even below the cut",
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
            <div className={figureFirst ? "lg:order-2" : ""}>
              <h3 className="heading-4 text-neutral-900">{block.title}</h3>

              {block.paragraphs.map((paragraph) => (
                <p
                  key={paragraph.slice(0, 40)}
                  className="mt-4 max-w-prose leading-relaxed text-neutral-600"
                >
                  {paragraph}
                </p>
              ))}

              <ul className="mt-6 space-y-2.5">
                {block.points.map((point) => (
                  <li key={point} className="flex items-start gap-2.5">
                    <Check
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary-600"
                      aria-hidden="true"
                    />
                    <span className="text-sm leading-relaxed text-neutral-600">
                      {point}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className={figureFirst ? "lg:order-1" : ""}>{block.figure}</div>
          </div>
        );
      })}
    </div>
  );
}
