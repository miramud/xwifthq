import Image from "next/image";

import { HUE, type ProductHue } from "@/lib/products";

/**
 * A real screen from the running suite, in the same browser frame the drawn
 * mocks use (owner, 9 Oct 2026: the site shows each module's actual
 * dashboards, captured from the Meridian Polytechnic demo organisation; re-captured
 * 26 Oct 2026 after the dashboard redesign).
 *
 * The files live in `public/images/screens/*.webp`, 1440 × 900 captures. The
 * address bar carries the in-app path so a reader can see where in the
 * product the screen lives; the caption, when given, says what it shows.
 *
 * Unlike `MockFrame`, this *is* a screenshot and says so: the alt text names
 * the screen, and the frame chrome stays decorative.
 */
export const SCREENS = {
  suiteHome: { src: "/images/screens/suite-home-v2.webp", path: "/suite", alt: "Suite home: every module the person can open, on one sign-in" },
  approvals: { src: "/images/screens/approvals-inbox-v2.webp", path: "/suite/approvals", alt: "The unified approvals inbox across every module" },
  orgConsole: { src: "/images/screens/org-console-v2.webp", path: "/suite/org", alt: "The organisation console: structure, roles, approvals and numbering" },

  financeDashboard: { src: "/images/screens/finance-dashboard-v2.webp", path: "/suite/finance", alt: "Finance overview: cash at bank, income and surplus for the year, net assets and work waiting" },
  financeProjects: { src: "/images/screens/finance-projects-v2.webp", path: "/suite/finance/projects", alt: "Project funds: released, committed, spent and available across every project" },
  financeCompanyReport: { src: "/images/screens/finance-company-report-v2.webp", path: "/suite/finance/reports/company", alt: "The company finance report: every analysis for a period, printable" },
  financeVouchers: { src: "/images/screens/finance-vouchers-v2.webp", path: "/suite/finance/vouchers", alt: "Payment vouchers from memo to bank" },
  financeBanking: { src: "/images/screens/finance-banking-v2.webp", path: "/suite/finance/banking", alt: "Banking: statement import, review and reconciliation" },
  financeBudgets: { src: "/images/screens/finance-budgets-v2.webp", path: "/suite/finance/budgets", alt: "Company budgets against actual" },

  operationsDashboard: { src: "/images/screens/operations-dashboard-v2.webp", path: "/suite/operations", alt: "Operations overview: purchasing, deliveries, trips, events and stock" },
  opsTravel: { src: "/images/screens/ops-travel-v2.webp", path: "/suite/operations/travel", alt: "Travel desk with its calendar" },
  opsEvents: { src: "/images/screens/ops-events-v2.webp", path: "/suite/operations/events", alt: "Events, workshops and engagements with their budgets" },
  opsAssets: { src: "/images/screens/ops-assets-v2.webp", path: "/suite/operations/assets", alt: "The asset register" },
  opsStores: { src: "/images/screens/ops-stores-v2.webp", path: "/suite/operations/stores", alt: "Stores and stock" },
  opsFleet: { src: "/images/screens/ops-fleet-v2.webp", path: "/suite/operations/fleet", alt: "Fleet: vehicles, papers and bookings" },

  hrmDashboard: { src: "/images/screens/hrm-dashboard-v2.webp", path: "/suite/hrm", alt: "People overview: headcount, onboarding, probation and who is in today" },
  hrmPeople: { src: "/images/screens/hrm-people-v2.webp", path: "/suite/hrm/people", alt: "The people directory" },
  hrmPayroll: { src: "/images/screens/hrm-payroll-v2.webp", path: "/suite/hrm/payroll", alt: "Payroll runs: net, gross, deductions and employer cost" },
  hrmLeave: { src: "/images/screens/hrm-leave-v2.webp", path: "/suite/hrm/leave", alt: "Leave requests and balances" },
  hrmRecruitment: { src: "/images/screens/hrm-recruitment-v2.webp", path: "/suite/hrm/recruitment", alt: "Recruitment pipeline" },
  hrmPerformance: { src: "/images/screens/hrm-performance-v2.webp", path: "/suite/hrm/performance", alt: "Performance: goals, KPIs and appraisals" },

  projectsDashboard: { src: "/images/screens/projects-dashboard-v2.webp", path: "/suite/projects", alt: "Projects overview: open projects, what is past its target, what is due next and clients" },
  projectsBoard: { src: "/images/screens/projects-board-v2.webp", path: "/suite/projects/student-portal-rebuild", alt: "A project's backlog grouped by epic" },
  projectsPerformance: { src: "/images/screens/projects-performance-v2.webp", path: "/suite/projects/…/performance", alt: "Team performance: velocity, variability and a forecast from real sprints" },
  projectsFinance: { src: "/images/screens/projects-finance-v2.webp", path: "/suite/projects/…/finance", alt: "Expected expense against actual, on the project itself" },
  projectsSchedule: { src: "/images/screens/projects-schedule-v2.webp", path: "/suite/projects/…/schedule", alt: "The schedule and critical path" },

  lmsDashboard: { src: "/images/screens/lms-dashboard-v2.webp", path: "/suite/lms", alt: "Learning overview: staff in training, completions, courses and ratings" },
  lmsCourses: { src: "/images/screens/lms-courses-v2.webp", path: "/suite/lms/courses", alt: "The course catalogue" },
} as const;

export type ScreenKey = keyof typeof SCREENS;

export function ProductScreenshot({
  screen,
  hue,
  caption,
  priority = false,
  className = "",
}: {
  screen: ScreenKey;
  hue: ProductHue;
  caption?: string;
  priority?: boolean;
  className?: string;
}) {
  const s = SCREENS[screen];
  const tokens = HUE[hue];

  return (
    <figure className={className}>
      <div className="xw-frame overflow-hidden">
        <div className="flex items-center gap-3 border-b border-neutral-100 bg-white px-4 py-2.5" aria-hidden="true">
          <span className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
            <span className="h-2.5 w-2.5 rounded-full bg-neutral-200" />
          </span>
          <span className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-neutral-100 px-3 py-1">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tokens.rule}`} />
            <span className="truncate text-[11px] font-medium text-neutral-500">{s.path}</span>
          </span>
        </div>
        <Image
          src={s.src}
          alt={s.alt}
          width={1440}
          height={900}
          priority={priority}
          sizes="(min-width: 1280px) 1100px, 100vw"
          className="block h-auto w-full"
        />
      </div>
      {caption && <figcaption className="mt-3 text-sm text-neutral-600">{caption}</figcaption>}
    </figure>
  );
}
