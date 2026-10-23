import { Check } from "lucide-react";
import {
  LeaveCalendarFigure,
  LeaverClearanceFigure,
  OrgTreeFigure,
  PayrollJournalFigure,
} from "@/suite/hrm/components/marketing/HrmVisuals";

/**
 * The four blocks that carry the HRM page.
 *
 * Text and figure alternate sides down the page so the eye has somewhere to go
 * between blocks, and the figure always sits *below* its text on small
 * screens: a drawing you have to scroll past to reach the sentence explaining
 * it is a decoration, not an illustration.
 *
 * Each figure sits on a pale lilac panel so it floats like the product frames
 * on the home page, and the points use the purple check circle.
 *
 * Every point here names something the module does today (owner, 9 Oct 2026:
 * the suite is complete, so nothing on this page is "coming").
 */

interface Block {
  title: string;
  paragraphs: string[];
  points: string[];
  figure: React.ReactNode;
}

const BLOCKS: Block[] = [
  {
    title: "One employee record, from offer to exit",
    paragraphs: [
      "Create each person once. Everything after that lands on the same record: contract and renewals, probation, leave balances, payslips, appraisals, cases and completed training. There is no second roster to reconcile, because there is no second roster.",
      "Departments, reporting lines and job titles come from the same organisation structure the rest of the suite uses. Supervisors see their people under My team, and a reorganisation updates every approval route at once.",
    ],
    points: [
      "Staff directory with personal details, emergency contacts and documents that track expiry dates",
      "Onboarding checklists that can assign new hires their induction courses",
      "Probation tracked through to a confirmation decision, not a forgotten date",
      "Issue, renew or end contracts, with a renewals list before anything lapses",
      "Interns and fixed-term staff on the same record as everyone else",
    ],
    figure: <OrgTreeFigure />,
  },
  {
    title: "Time, attendance and leave that always agree",
    paragraphs: [
      "Rotas, attendance, timesheets and leave are one subject, not four. A day approved as annual leave cannot also show up as an unexplained absence, and overtime worked is overtime paid in the next run.",
      "Requests go to the supervisor first, then wherever your approval rules send them, all through the same approvals inbox every module uses. Staff see their balance before they ask.",
    ],
    points: [
      "Leave types with accrual, carry-over and manual adjustments",
      "Shift rota with coverage, and attendance tracked against it",
      "Timesheets approved up the reporting line",
      "Public holidays, plus a team calendar for supervisors",
      "Self-service: My leave, My payslips, My documents, My cases",
    ],
    figure: <LeaveCalendarFigure />,
  },
  {
    title: "Payroll that posts straight to the books",
    paragraphs: [
      "Each payroll run calculates gross pay, statutory deductions (PAYE, pension and NHF) and the total cost to the company once employer contributions are added. Overtime and approved adjustments flow in from the rest of HRM, so nobody retypes them.",
      "Approve the run and its journal goes to XwiftHQ Finance, on the same chart of accounts you close the month on. Payroll cost shows up in the books and in each project's labour figures, with no spreadsheet in between.",
    ],
    points: [
      "Earnings and deduction elements set up once, applied to every run",
      "PAYE, pension and NHF calculated per employee",
      "Employer cost shown next to net and gross on every run",
      "Payslips every employee can open from their own account",
      "The payroll journal posted to Finance when the run is approved",
    ],
    figure: <PayrollJournalFigure />,
  },
  {
    title: "Leavers, final pay and the cases in between",
    paragraphs: [
      "When someone leaves, HRM runs the clearance: exit interview, access revoked, final settlement. Final pay stays on hold while the asset register in XwiftHQ Admin shows them holding company property, or Finance shows an advance they have not retired.",
      "Before that, employee relations live here too. Employees can raise grievances directly, disciplinary cases move through the process stage by stage, and warnings expire on the date set when they were issued.",
    ],
    points: [
      "Leavers board with a clearance checklist and exit interview",
      "Final pay blocked until assets come back and advances are retired",
      "Grievances raised by staff directly and kept confidential",
      "Disciplinary cases and warnings with expiry dates",
      "Workforce analytics: turnover, tenure, absence and leave liability",
    ],
    figure: <LeaverClearanceFigure />,
  },
];

export function HrmDeepDive() {
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
              <p className="xw-eyebrow tnum" aria-hidden="true">
                {String(index + 1).padStart(2, "0")} / {String(BLOCKS.length).padStart(2, "0")}
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

              <ul className="mt-6 space-y-3">
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

            <div
              className={`min-w-0 rounded-[1.5rem] bg-gradient-to-br from-primary-100 via-primary-50 to-white p-3 sm:p-6 ${
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
