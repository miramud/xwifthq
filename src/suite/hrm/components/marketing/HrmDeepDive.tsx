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
 * between blocks, and the figure is always *below* its text on small screens —
 * a drawing you have to scroll past to reach the sentence explaining it is a
 * decoration, not an illustration.
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
      "A member of staff is created once, and everything that happens to them attaches to the same record — the contract and its renewals, probation, leave balances, payslips, appraisals, cases and the training they have finished. There is no second roster to reconcile, because there is no second roster.",
      "Departments, reporting lines and job titles come from the organisation the rest of the suite already uses. A supervisor sees their own people under My team, and a reorganisation moves every approval route at once.",
    ],
    points: [
      "Staff directory with personal details, emergency contacts and documents with expiry dates",
      "Onboarding checklists that can hand a new hire their induction courses",
      "Probation tracked to a confirmation decision, not a forgotten date",
      "Contracts issued, renewed or ended, with a renewals list before they lapse",
      "Internships and fixed-term staff on the same record as everyone else",
    ],
    figure: <OrgTreeFigure />,
  },
  {
    title: "Time, attendance and leave that agree with each other",
    paragraphs: [
      "Rotas, attendance, timesheets and leave are one subject, not four. A day approved as annual leave cannot also surface as an unexplained absence, and overtime worked is overtime paid in the next run.",
      "Requests go to the person's supervisor and then wherever your approval rules send them, through the same approvals inbox every module uses. Staff see their own balance before they ask.",
    ],
    points: [
      "Leave types with accrual, carry-over and manual adjustments",
      "Shift rota with coverage, and attendance against it",
      "Timesheets approved along the reporting line",
      "Public holidays and a team calendar for the supervisor",
      "Self-service: My leave, My payslips, My documents, My cases",
    ],
    figure: <LeaveCalendarFigure />,
  },
  {
    title: "Payroll that posts to the books",
    paragraphs: [
      "A payroll run works out gross pay, statutory deductions — PAYE, pension and NHF — and what the run costs the company once employer contributions are added. Overtime and approved adjustments flow in from the rest of HRM rather than being re-typed.",
      "When the run is approved, its journal goes to Elevate Finance on the same chart of accounts the month is closed on, so payroll cost appears in the books and in each project's labour figures without a spreadsheet in between.",
    ],
    points: [
      "Earnings and deduction elements set up once, applied every run",
      "PAYE, pension and NHF calculated per employee",
      "Employer cost shown beside net and gross on every run",
      "Payslips each employee can open from their own account",
      "The payroll journal posted to Finance when the run is approved",
    ],
    figure: <PayrollJournalFigure />,
  },
  {
    title: "Leavers, final pay, and the cases in between",
    paragraphs: [
      "When somebody leaves, HRM runs the clearance: exit interview, access revoked, and a final settlement. Final pay stays held while the asset register in Elevate Admin still shows them holding company property, or Finance shows an advance they have not retired.",
      "Before that point, employee relations live here too. Grievances can be raised by the employee directly, disciplinary cases follow the process stage by stage, and warnings expire on the date they were given for.",
    ],
    points: [
      "Leavers board with clearance checklist and exit interview",
      "Final pay blocked until assets are returned and advances retired",
      "Grievances raised by staff themselves, kept confidential",
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
                      className="mt-0.5 h-4 w-4 shrink-0 text-violet-600"
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
