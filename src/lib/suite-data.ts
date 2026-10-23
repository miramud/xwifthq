import {
  Armchair,
  Banknote,
  BookOpenCheck,
  Boxes,
  Briefcase,
  Building2,
  ChartColumn,
  ClipboardCheck,
  Clock,
  Coins,
  CreditCard,
  FileSpreadsheet,
  FileText,
  FolderTree,
  Gavel,
  Handshake,
  Hourglass,
  IdCard,
  Landmark,
  Layers,
  LayoutDashboard,
  ListChecks,
  MapPin,
  Network,
  Package,
  Percent,
  PiggyBank,
  Plane,
  Receipt,
  Repeat,
  Route,
  Scale,
  ScrollText,
  ShieldCheck,
  Signature,
  SquareKanban,
  Target,
  Ticket,
  Timer,
  Trophy,
  Truck,
  UserPlus,
  UserRoundPlus,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Tone } from "@/components/dashboard/ui";
import type { ProductSlug } from "@/lib/products";
import { formatCompactNaira } from "@/lib/console-data";

/**
 * Static fixtures for the four preview modules.
 *
 * There is no API behind HRM, Finance, Admin or Projects. Everything in this
 * file is invented, and the whole of `/suite` is built on the assumption that
 * a reader will be told so: every preview page carries a PreviewBanner, every
 * tile carries a "Preview" pill, and no control anywhere in the shell fires a
 * request it cannot answer.
 *
 * Three consequences shape how the data is written:
 *
 * 1. Timestamps are fixed, neutral labels ("Today, 09:14") rather than
 *    relative ones. "2 minutes ago" recomputes on every render and would claim
 *    a freshness no fixture has.
 * 2. Figures are plausible for a mid-sized organisation and obviously
 *    round-ish. They are illustrative, not benchmarks, and nothing here should
 *    ever be quoted back as a result Elevate produced for someone.
 * 3. People, vendors and customers are plainly fictional. No real company
 *    appears, and nothing reads as a testimonial.
 *
 * Money is Naira, formatted through `formatCompactNaira` from `admin-data` so
 * the suite and the LMS console round the same way.
 */

/* ------------------------------------------------------------------ */
/*  Shared shapes                                                      */
/* ------------------------------------------------------------------ */

/**
 * Status colour. Aliased from the dashboard primitives' `Tone` so a fixture
 * row can carry the pill tone it should render with and the two can never
 * drift apart. Colour is never the only carrier — every row pairs the tone
 * with a `status` word.
 */
export type StatusTone = Tone;

export interface KpiItem {
  label: string;
  value: string;
  /** Signed, pre-formatted, e.g. "+4.2%" or "-11". Optional. */
  delta?: string;
  /**
   * Direction only. Deliberately not "good" or "bad": headcount down is not
   * automatically worse than headcount up, and the UI does not colour it.
   */
  trend?: "up" | "down" | "flat";
  icon: LucideIcon;
}

export interface BarDatum {
  label: string;
  value: number;
}

export interface SuiteNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /**
   * True only where `href` is a route that exists today. The preview modules
   * ship one dashboard each, so most sections in a module's rail have nowhere
   * to go — and a nav item that navigates nowhere is the fastest way to make a
   * preview feel fake. The shell renders these as visibly disabled instead,
   * with a title saying why. Flip this to `true` the day the route lands.
   */
  available?: boolean;
}

export interface SuiteNavGroup {
  heading: string;
  items: SuiteNavItem[];
}

export interface SuiteActivityEntry {
  /** Fixed label, never relative. */
  time: string;
  module: ProductSlug;
  title: string;
  detail?: string;
}

export interface SuiteSummaryFigure {
  label: string;
  value: string;
}

export interface QuickAction {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Which module owns the action — drives the icon tile's hue only. */
  module: ProductSlug;
}

/** Every module except the LMS, which has a real console at /admin. */
export type PreviewSlug = Exclude<ProductSlug, "lms">;

/** Exact Naira, for amounts a person would reconcile against. */
export function naira(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}₦${Math.abs(amount).toLocaleString("en-NG")}`;
}

/** Compact Naira, e.g. ₦82.5M. Re-exported so dashboards import one helper. */
export { formatCompactNaira };

/**
 * The instant the whole suite is stamped at.
 *
 * Every fixture in this file is written as if it were this moment, so "today"
 * in the activity feed, "this week" on the leave strip and "at 30 September"
 * on the receivables ageing all mean the same day. Anything deriving an age, a
 * week or an overdue count measures against this, never against the clock.
 */
export const SUITE_AS_AT = "2026-09-30";

const MONTH_LABEL = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * Parsed at UTC midnight. A bare `new Date("2026-09-28")` is already UTC, but
 * `new Date(2026, 8, 28)` is local — and a fixture that moves a day when the
 * reader is west of Greenwich is exactly the class of drift this file exists
 * to stop.
 */
export function suiteDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

/** Mon–Fri days between two inclusive ISO dates. */
export function workingDays(startIso: string, endIso: string): number {
  const end = suiteDate(endIso).getTime();
  let count = 0;

  for (let day = suiteDate(startIso).getTime(); day <= end; day += 86_400_000) {
    const weekday = new Date(day).getUTCDay();
    if (weekday !== 0 && weekday !== 6) count += 1;
  }

  return count;
}

/** "21–25 Sep" within a month, "28 Sep – 2 Oct" across one. */
export function dateRangeLabel(startIso: string, endIso: string): string {
  const start = suiteDate(startIso);
  const end = suiteDate(endIso);
  const startMonth = MONTH_LABEL[start.getUTCMonth()];
  const endMonth = MONTH_LABEL[end.getUTCMonth()];

  return startMonth === endMonth
    ? `${start.getUTCDate()}–${end.getUTCDate()} ${endMonth}`
    : `${start.getUTCDate()} ${startMonth} – ${end.getUTCDate()} ${endMonth}`;
}

/* ------------------------------------------------------------------ */
/*  Section navigation for each preview module                         */
/* ------------------------------------------------------------------ */

/**
 * The rail inside a module. These are the real section maps of the four
 * products — the same groups the product pages describe — so the shell shows
 * the shape of the module rather than a stub. Only the overview route exists
 * today; see `SuiteNavItem.available`.
 */
export const SUITE_NAV: Record<PreviewSlug, SuiteNavGroup[]> = {
  hrm: [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", href: "/suite/hrm", icon: LayoutDashboard, available: true },
        { label: "Org chart", href: "/suite/hrm/org-chart", icon: Network },
      ],
    },
    {
      heading: "People",
      items: [
        { label: "Employees", href: "/suite/hrm/employees", icon: Users },
        { label: "Contracts", href: "/suite/hrm/contracts", icon: Signature },
        { label: "Onboarding", href: "/suite/hrm/onboarding", icon: UserPlus },
        { label: "Offboarding", href: "/suite/hrm/offboarding", icon: Briefcase },
        { label: "Documents", href: "/suite/hrm/documents", icon: FileText },
      ],
    },
    {
      heading: "Time & pay",
      items: [
        { label: "Attendance", href: "/suite/hrm/attendance", icon: Clock },
        { label: "Leave", href: "/suite/hrm/leave", icon: Plane },
        { label: "Payroll", href: "/suite/hrm/payroll", icon: Banknote },
        { label: "Statutory filings", href: "/suite/hrm/statutory", icon: Scale },
      ],
    },
    {
      heading: "Growth",
      items: [
        { label: "Recruitment", href: "/suite/hrm/recruitment", icon: UserRoundPlus },
        { label: "Performance", href: "/suite/hrm/performance", icon: Target },
        { label: "Competency matrix", href: "/suite/hrm/competencies", icon: Layers },
        { label: "Learning record", href: "/suite/hrm/learning", icon: BookOpenCheck },
      ],
    },
  ],
  finance: [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", href: "/suite/preview/finance", icon: LayoutDashboard, available: true },
        { label: "Chart of accounts", href: "/suite/finance/accounts", icon: Landmark },
      ],
    },
    {
      heading: "Receivables",
      items: [
        { label: "Invoices", href: "/suite/finance/revenue/invoices", icon: Receipt },
        { label: "Clients", href: "/suite/finance/revenue/clients", icon: Handshake },
        { label: "Receipts", href: "/suite/finance/revenue/receipts", icon: Coins },
        { label: "Receivables", href: "/suite/finance/revenue/receivables", icon: Repeat },
      ],
    },
    {
      heading: "Payables",
      items: [
        { label: "Payment vouchers", href: "/suite/finance/vouchers", icon: FileText },
        { label: "Payments", href: "/suite/finance/payments", icon: CreditCard },
        { label: "Payment requests", href: "/suite/finance/requests", icon: Wallet },
      ],
    },
    {
      heading: "Control",
      items: [
        { label: "Banking", href: "/suite/finance/banking", icon: PiggyBank },
        { label: "Budgets", href: "/suite/finance/budgets", icon: ChartColumn },
        { label: "Reports", href: "/suite/finance/reports", icon: Percent },
        { label: "Periods & close", href: "/suite/finance/periods", icon: FileSpreadsheet },
      ],
    },
  ],
  admin: [
    {
      heading: "Overview",
      items: [
        { label: "Dashboard", href: "/suite/preview/admin", icon: LayoutDashboard, available: true },
        { label: "Organisation tree", href: "/suite/admin/organisation", icon: FolderTree },
      ],
    },
    {
      heading: "Estate",
      items: [
        { label: "Assets", href: "/suite/admin/assets", icon: Boxes },
        { label: "Facilities", href: "/suite/admin/facilities", icon: Building2 },
        { label: "Locations", href: "/suite/admin/locations", icon: MapPin },
        { label: "Maintenance", href: "/suite/admin/maintenance", icon: Wrench },
        { label: "Workspace bookings", href: "/suite/admin/bookings", icon: Armchair },
      ],
    },
    {
      heading: "Procurement",
      items: [
        { label: "Requisitions", href: "/suite/admin/requisitions", icon: ClipboardCheck },
        { label: "Purchase orders", href: "/suite/admin/purchase-orders", icon: Package },
        { label: "Goods received", href: "/suite/admin/grn", icon: Truck },
        { label: "Approval matrix", href: "/suite/admin/approvals", icon: Network },
      ],
    },
    {
      heading: "Governance",
      items: [
        { label: "Policies", href: "/suite/admin/policies", icon: Gavel },
        { label: "Compliance register", href: "/suite/admin/compliance", icon: ShieldCheck },
        { label: "Access & keys", href: "/suite/admin/access", icon: IdCard },
        { label: "Audit trail", href: "/suite/admin/audit", icon: ScrollText },
      ],
    },
  ],
  projects: [
    /*
      Projects is built and wears its own shell (`ProjectsShell`), so this rail
      only mirrors that one. It used to list the preview's imagined sections
      (/suite/projects/board, /time, /risks...), and every one of those paths
      lands on the `[slug]` route as a project that does not exist.
    */
    {
      heading: "Delivery",
      items: [
        { label: "Projects", href: "/suite/projects", icon: LayoutDashboard, available: true },
        { label: "Portfolios", href: "/suite/projects/portfolios", icon: FolderTree, available: true },
        { label: "External companies", href: "/suite/projects/companies", icon: Building2, available: true },
      ],
    },
    {
      heading: "Mine",
      items: [{ label: "My work", href: "/suite/projects/me", icon: ListChecks, available: true }],
    },
    {
      heading: "Settings",
      items: [{ label: "Rates", href: "/suite/projects/rates", icon: Wallet, available: true }],
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Launcher: activity, summaries, quick actions                       */
/* ------------------------------------------------------------------ */

/**
 * The launcher's cross-module stream — the one screen where all five modules
 * appear at once, which is the suite argument made visible. The entries trace
 * the five documented flows on purpose: a hire moving through HRM, Admin, LMS
 * and Projects; a timesheet becoming an invoice; a policy becoming evidence.
 */
export const SUITE_ACTIVITY: readonly SuiteActivityEntry[] = [
  {
    time: "Today, 09:14",
    module: "hrm",
    title: "Offer accepted — Adaeze Nwosu, Field Engineer",
    detail: "Start date 1 October. Employee record created on the shared org tree.",
  },
  {
    time: "Today, 09:15",
    module: "admin",
    title: "Asset bundle issued for Adaeze Nwosu",
    detail: "Laptop LT-0148, access card AC-2291, Lagos — Yaba desk 4B.",
  },
  {
    time: "Today, 09:16",
    module: "lms",
    title: "Onboarding pathway assigned",
    detail: "Six courses, due within 30 days of the start date.",
  },
  {
    time: "Today, 10:02",
    module: "projects",
    title: "Added to the Meridian rollout team",
    detail: "Capacity set to 30 hours a week until the probation review.",
  },
  {
    time: "Today, 11:38",
    module: "projects",
    title: "142 hours marked billable on Meridian rollout",
    detail: "Handed to Finance as draft invoice lines, unposted.",
  },
  {
    time: "Today, 12:05",
    module: "finance",
    title: "Invoice INV-2291 raised from the timesheet",
    detail:
      "₦8.4M, 30-day terms, matched to the Meridian contract. Unposted until Finance approves it.",
  },
  {
    time: "Yesterday, 16:40",
    module: "admin",
    title: "Requisition REQ-0884 cleared the approval matrix",
    detail: "Two-stage approval: department head, then facilities.",
  },
  {
    time: "Yesterday, 16:41",
    module: "finance",
    title: "Bill BIL-0771 received already matched to PO and GRN",
    detail: "Three-way match complete; queued for the payment run.",
  },
  {
    time: "Mon, 14:20",
    module: "admin",
    title: "Information Security Policy v4 published",
    detail: "Effective 1 October across all four locations.",
  },
  {
    time: "Mon, 14:22",
    module: "lms",
    title: "Policy issued as an acknowledgement course",
    detail: "184 of 210 staff have attested; HRM holds the record.",
  },
];

/**
 * The purchase ledger as a whole, which is bigger than the table Finance shows.
 *
 * `FINANCE_DATA.payables` is a working queue — the bills a person is about to
 * act on — not the ledger. The two figures here are the ledger, and both the
 * launcher tile and the Finance KPI row read them, so the queue can describe
 * itself as a slice of a number that is stated in exactly one place. The
 * receivables table needs no equivalent: it is the whole open ledger.
 */
export const PAYABLES_LEDGER = {
  bills: 23,
  total: 31_900_000,
} as const;

/**
 * Three figures per tile on the launcher.
 *
 * The LMS's three are product facts rather than usage numbers. It is the one
 * live module, so inventing a headline metric for it would be the one place on
 * this screen where a fixture could be mistaken for a real reading.
 */
export const SUITE_SUMMARY: Record<ProductSlug, SuiteSummaryFigure[]> = {
  lms: [
    { label: "Lecture types", value: "3" },
    { label: "Question types", value: "4" },
    { label: "Verification", value: "Public" },
  ],
  hrm: [
    { label: "Headcount", value: "210" },
    { label: "Open roles", value: "7" },
    { label: "Leave pending", value: "12" },
  ],
  finance: [
    { label: "Cash position", value: "₦126.4M" },
    { label: "Overdue AR", value: "₦18.2M" },
    { label: "Bills to pay", value: `${PAYABLES_LEDGER.bills}` },
  ],
  admin: [
    { label: "Assets tracked", value: "486" },
    { label: "Approvals waiting", value: "9" },
    { label: "Policies live", value: "31" },
  ],
  projects: [
    { label: "Active projects", value: "14" },
    { label: "Tasks in flight", value: "168" },
    { label: "Billable this month", value: "1,240h" },
  ],
};

/**
 * Starting points from the launcher. Every one of these resolves to a live
 * console (all five modules are live since 9 October 2026), so none of them
 * points at a preview dashboard.
 */
export const QUICK_ACTIONS: readonly QuickAction[] = [
  { label: "Assign a pathway", href: "/suite/lms/learning-paths", icon: Route, module: "lms" },
  { label: "Add a course", href: "/suite/lms/courses", icon: BookOpenCheck, module: "lms" },
  { label: "Issue certificates", href: "/suite/lms/certificates", icon: Trophy, module: "lms" },
  { label: "Check seats", href: "/suite/org/seats", icon: Ticket, module: "lms" },
  { label: "Audit & health", href: "/suite/org/audit", icon: ShieldCheck, module: "lms" },
  { label: "People & payroll", href: "/suite/hrm", icon: Users, module: "hrm" },
  { label: "Ledger & invoices", href: "/suite/finance", icon: Wallet, module: "finance" },
  { label: "Assets & approvals", href: "/suite/operations", icon: Building2, module: "admin" },
  { label: "Boards & sprints", href: "/suite/projects", icon: SquareKanban, module: "projects" },
];

/* ------------------------------------------------------------------ */
/*  Elevate HRM                                                        */
/* ------------------------------------------------------------------ */

export interface LeaveRow {
  id: string;
  person: string;
  team: string;
  type: "Annual" | "Sick" | "Parental" | "Study" | "Compassionate";
  /** ISO, inclusive. The register's only date truth. */
  start: string;
  end: string;
  /** Mon–Fri days in the window. Derived. */
  days: number;
  /** Readable range, e.g. "21–25 Sep". Derived. */
  window: string;
  status: string;
  tone: StatusTone;
}

/**
 * A request as a person actually files it: two dates and a decision.
 *
 * The readable range and the working-day count are derived from those dates
 * rather than typed beside them. The previous version carried all three by
 * hand and six of nine rows disagreed with the 2026 calendar — five of them
 * because a Mon–Fri count had been written against a window that ended on a
 * Saturday. A count that is computed cannot make that mistake, and a week
 * strip that projects these dates cannot invent a day nobody requested.
 */
interface LeaveRequest {
  id: string;
  person: string;
  team: string;
  type: LeaveRow["type"];
  /** ISO, inclusive. */
  start: string;
  end: string;
  status: string;
  tone: StatusTone;
}

/**
 * The working week the HRM dashboard calls "this week".
 *
 * It is the week containing `SUITE_AS_AT` — Wednesday 30 September 2026 —
 * which is the only week that can honestly be called that. The strip reads
 * this and the register; neither the label nor the grid is typed twice.
 */
export const HRM_LEAVE_WEEK = {
  /** Monday of the week. The other four days are counted off it. */
  monday: "2026-09-28",
  friday: "2026-10-02",
  label: "28 September – 2 October",
  short: "28 Sep – 2 Oct",
} as const;

export interface OnboardingRow {
  id: string;
  person: string;
  role: string;
  startDate: string;
  stage: string;
  /** 0–100, against the onboarding checklist. */
  progress: number;
  buddy: string;
}

export interface PayrollLine {
  label: string;
  amount: number;
}

export interface PayrollRun {
  period: string;
  status: string;
  tone: StatusTone;
  employees: number;
  gross: number;
  deductions: number;
  net: number;
  /** Where the journal lands in Finance — the point of one ledger. */
  postedTo: string;
  lines: PayrollLine[];
}

export interface HrmData {
  kpis: KpiItem[];
  /** Headcount by division. */
  headcount: BarDatum[];
  leave: LeaveRow[];
  onboarding: OnboardingRow[];
  payrollRun: PayrollRun;
}

/**
 * The leave register, newest decisions and future windows together.
 *
 * Rows lv-10 to lv-14 exist so that the week containing the as-at date has
 * a real shape to project. Before them the register held one request in that
 * week, which is why the week strip used to declare its own rows and drifted
 * away from this table. Nothing here is pending except the three requests the
 * approvals queue shows, so adding them did not move that count.
 */
const LEAVE_REGISTER: readonly LeaveRequest[] = [
  {
    id: "lv-01",
    person: "Obiageli Umeh",
    team: "Delivery",
    type: "Annual",
    start: "2026-09-21",
    end: "2026-09-25",
    status: "Awaiting manager",
    tone: "warning",
  },
  {
    id: "lv-02",
    person: "Tunde Balogun",
    team: "Engineering",
    type: "Study",
    start: "2026-09-28",
    end: "2026-10-02",
    status: "Approved",
    tone: "success",
  },
  {
    id: "lv-03",
    person: "Chiamaka Eze",
    team: "Commercial",
    type: "Parental",
    start: "2026-10-01",
    end: "2026-12-25",
    status: "Approved",
    tone: "success",
  },
  {
    id: "lv-04",
    person: "Ibrahim Sule",
    team: "Operations",
    type: "Sick",
    start: "2026-09-15",
    end: "2026-09-16",
    status: "Recorded",
    tone: "neutral",
  },
  {
    id: "lv-05",
    person: "Ngozi Okafor",
    team: "Delivery",
    type: "Annual",
    start: "2026-10-05",
    end: "2026-10-16",
    status: "Awaiting manager",
    tone: "warning",
  },
  {
    id: "lv-06",
    person: "Emeka Obi",
    team: "Engineering",
    type: "Annual",
    start: "2026-10-13",
    end: "2026-10-15",
    status: "Approved",
    tone: "success",
  },
  {
    id: "lv-07",
    person: "Fatima Bello",
    team: "Finance",
    type: "Compassionate",
    start: "2026-09-17",
    end: "2026-09-18",
    status: "Approved",
    tone: "success",
  },
  {
    id: "lv-08",
    person: "Segun Adeyemi",
    team: "Facilities",
    type: "Annual",
    start: "2026-10-19",
    end: "2026-10-23",
    status: "Declined — cover",
    tone: "error",
  },
  {
    id: "lv-09",
    person: "Hauwa Lawal",
    team: "People",
    type: "Annual",
    start: "2026-11-02",
    end: "2026-11-06",
    status: "Awaiting manager",
    tone: "warning",
  },
  {
    id: "lv-10",
    person: "Yemi Adebayo",
    team: "Delivery",
    type: "Annual",
    start: "2026-09-28",
    end: "2026-09-30",
    status: "Approved",
    tone: "success",
  },
  {
    id: "lv-11",
    person: "Uche Nnamdi",
    team: "Commercial",
    type: "Annual",
    start: "2026-09-28",
    end: "2026-09-29",
    status: "Approved",
    tone: "success",
  },
  {
    id: "lv-12",
    person: "Halima Bala",
    team: "Operations",
    type: "Sick",
    start: "2026-09-29",
    end: "2026-09-30",
    status: "Recorded",
    tone: "neutral",
  },
  {
    id: "lv-13",
    person: "Tope Ogundele",
    team: "Facilities",
    type: "Compassionate",
    start: "2026-09-30",
    end: "2026-10-02",
    status: "Approved",
    tone: "success",
  },
  {
    id: "lv-14",
    person: "Ifeoma Nwachukwu",
    team: "People",
    type: "Annual",
    start: "2026-10-01",
    end: "2026-10-02",
    status: "Approved",
    tone: "success",
  },
];

const LEAVE: LeaveRow[] = LEAVE_REGISTER.map((request) => ({
  ...request,
  days: workingDays(request.start, request.end),
  window: dateRangeLabel(request.start, request.end),
}));

export const HRM_DATA: HrmData = {
  kpis: [
    { label: "Headcount", value: "210", delta: "+6", trend: "up", icon: Users },
    { label: "Open roles", value: "7", delta: "-2", trend: "down", icon: UserRoundPlus },
    { label: "Attendance", value: "94.2%", delta: "+1.1pp", trend: "up", icon: Clock },
    { label: "Payroll cost", value: "₦96.8M", delta: "+3.4%", trend: "up", icon: Banknote },
  ],
  headcount: [
    { label: "Delivery", value: 68 },
    { label: "Engineering", value: 52 },
    { label: "Commercial", value: 31 },
    { label: "Operations", value: 24 },
    { label: "Finance", value: 14 },
    { label: "People", value: 11 },
    { label: "Facilities", value: 10 },
  ],
  leave: LEAVE,
  onboarding: [
    {
      id: "ob-01",
      person: "Adaeze Nwosu",
      role: "Field Engineer",
      startDate: "1 Oct",
      stage: "Assets issued",
      progress: 45,
      buddy: "Emeka Obi",
    },
    {
      id: "ob-02",
      person: "Kelechi Anyanwu",
      role: "Account Manager",
      startDate: "1 Oct",
      stage: "Contract signed",
      progress: 25,
      buddy: "Chiamaka Eze",
    },
    {
      id: "ob-03",
      person: "Zainab Yusuf",
      role: "Data Analyst",
      startDate: "15 Sep",
      stage: "Pathway in progress",
      progress: 70,
      buddy: "Tunde Balogun",
    },
    {
      id: "ob-04",
      person: "Oluwaseun Ajayi",
      role: "Site Supervisor",
      startDate: "15 Sep",
      stage: "Pathway in progress",
      progress: 62,
      buddy: "Ibrahim Sule",
    },
    {
      id: "ob-05",
      person: "Blessing Idowu",
      role: "Payroll Officer",
      startDate: "1 Sep",
      stage: "Probation review set",
      progress: 90,
      buddy: "Fatima Bello",
    },
    {
      id: "ob-06",
      person: "Musa Danjuma",
      role: "Procurement Lead",
      startDate: "1 Sep",
      stage: "Probation review set",
      progress: 88,
      buddy: "Segun Adeyemi",
    },
    {
      id: "ob-07",
      person: "Amara Okonkwo",
      role: "QA Engineer",
      startDate: "1 Nov",
      stage: "Offer accepted",
      progress: 10,
      buddy: "Tunde Balogun",
    },
  ],
  payrollRun: {
    period: "September 2026",
    status: "Ready to approve",
    tone: "warning",
    employees: 210,
    gross: 96_800_000,
    deductions: 21_450_000,
    net: 75_350_000,
    postedTo: "Finance — journal JV-2026-09-30",
    lines: [
      { label: "Basic", amount: 58_080_000 },
      { label: "Housing", amount: 19_360_000 },
      { label: "Transport", amount: 9_680_000 },
      { label: "Overtime", amount: 4_840_000 },
      { label: "Allowances", amount: 4_840_000 },
      { label: "PAYE", amount: -11_616_000 },
      { label: "Pension", amount: -7_744_000 },
      { label: "NHF", amount: -2_090_000 },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Elevate Finance                                                    */
/* ------------------------------------------------------------------ */

export interface ReceivableRow {
  id: string;
  invoice: string;
  customer: string;
  issued: string;
  due: string;
  amount: number;
  /** Bucket label, e.g. "Current", "31–60 days". */
  ageing: string;
  /**
   * Days past due at `SUITE_AS_AT`, or null where the invoice is not overdue.
   *
   * Carried on the row rather than computed from `due`, because the fixture's
   * dates are readable labels rather than parseable ones — and carried here
   * rather than in a lookup beside the table, because a map keyed by row id in
   * a component is a second copy of the register waiting to disagree with it.
   */
  daysOverdue: number | null;
  status: string;
  tone: StatusTone;
}

export interface PayableRow {
  id: string;
  bill: string;
  vendor: string;
  due: string;
  amount: number;
  /** Three-way match state — the reason Admin and Finance share a spine. */
  matched: "PO + GRN" | "PO only" | "Unmatched";
  status: string;
  tone: StatusTone;
}

export interface BudgetRow {
  id: string;
  name: string;
  owner: string;
  budget: number;
  spent: number;
  /** Pre-computed so the table never divides by zero in a render. */
  percent: number;
}

export interface FinanceData {
  kpis: KpiItem[];
  /**
   * Closing cash balance by month — a running position, not a per-month delta.
   *
   * The distinction matters and this comment used to get it wrong twice. The
   * final value is the cash-position KPI rounded to the nearest million — 126
   * against ₦126.4M, not "to the decimal" — and ₦74m of *movement* in a month
   * against a ₦126m balance would not be coherent. Anything deriving inflow and
   * outflow from this series must read consecutive values as steps between
   * balances.
   */
  cashflow: BarDatum[];
  receivables: ReceivableRow[];
  payables: PayableRow[];
  budgets: BudgetRow[];
}

export const FINANCE_DATA: FinanceData = {
  kpis: [
    { label: "Cash position", value: "₦126.4M", delta: "+8.1%", trend: "up", icon: PiggyBank },
    { label: "Receivables", value: "₦60.5M", delta: "-4.3%", trend: "down", icon: Receipt },
    { label: "Payables", value: "₦31.9M", delta: "+2.6%", trend: "up", icon: FileText },
    { label: "Unreconciled", value: "6 lines", trend: "flat", icon: Landmark },
  ],
  cashflow: [
    { label: "Feb", value: 74 },
    { label: "Mar", value: 82 },
    { label: "Apr", value: 69 },
    { label: "May", value: 91 },
    { label: "Jun", value: 104 },
    { label: "Jul", value: 97 },
    { label: "Aug", value: 118 },
    { label: "Sep", value: 126 },
  ],
  receivables: [
    {
      id: "ar-01",
      invoice: "INV-2291",
      customer: "Meridian Works Ltd",
      issued: "30 Sep",
      due: "30 Oct",
      amount: 8_400_000,
      ageing: "Current",
      daysOverdue: null,
      status: "Sent",
      tone: "info",
    },
    {
      id: "ar-02",
      invoice: "INV-2284",
      customer: "Harbourline Logistics",
      issued: "2 Sep",
      due: "2 Oct",
      amount: 12_150_000,
      ageing: "Current",
      daysOverdue: null,
      status: "Part paid",
      tone: "primary",
    },
    {
      id: "ar-03",
      invoice: "INV-2270",
      customer: "Kano Agro Cooperative",
      issued: "12 Aug",
      due: "11 Sep",
      amount: 5_600_000,
      ageing: "1–30 days",
      daysOverdue: 19,
      status: "Overdue",
      tone: "warning",
    },
    {
      id: "ar-04",
      invoice: "INV-2251",
      customer: "Delta Clinics Group",
      issued: "24 Jul",
      due: "23 Aug",
      amount: 9_875_000,
      ageing: "31–60 days",
      daysOverdue: 38,
      status: "Overdue",
      tone: "warning",
    },
    {
      id: "ar-05",
      invoice: "INV-2233",
      customer: "Riverstone Academy",
      issued: "30 Jun",
      due: "30 Jul",
      amount: 2_740_000,
      ageing: "61–90 days",
      daysOverdue: 62,
      status: "In dispute",
      tone: "error",
    },
    {
      id: "ar-06",
      invoice: "INV-2298",
      customer: "Orile Manufacturing",
      issued: "18 Sep",
      due: "18 Oct",
      amount: 15_300_000,
      ageing: "Current",
      daysOverdue: null,
      status: "Sent",
      tone: "info",
    },
    {
      id: "ar-07",
      invoice: "INV-2289",
      customer: "Bluecrest Energy",
      issued: "10 Sep",
      due: "10 Oct",
      amount: 6_420_000,
      ageing: "Current",
      daysOverdue: null,
      status: "Sent",
      tone: "info",
    },
  ],
  payables: [
    {
      id: "ap-01",
      bill: "BIL-0771",
      vendor: "Sahel Office Supplies",
      due: "30 Sep",
      amount: 1_840_000,
      matched: "PO + GRN",
      status: "Scheduled",
      tone: "info",
    },
    {
      id: "ap-02",
      bill: "BIL-0768",
      vendor: "Northgate Facilities",
      due: "28 Sep",
      amount: 3_600_000,
      matched: "PO + GRN",
      status: "Scheduled",
      tone: "info",
    },
    {
      id: "ap-03",
      bill: "BIL-0764",
      vendor: "Zenith Fleet Services",
      due: "24 Sep",
      amount: 2_275_000,
      matched: "PO only",
      status: "Awaiting GRN",
      tone: "warning",
    },
    {
      id: "ap-04",
      bill: "BIL-0759",
      vendor: "Corvus Cloud Hosting",
      due: "20 Sep",
      amount: 5_940_000,
      matched: "PO + GRN",
      status: "Paid",
      tone: "success",
    },
    {
      id: "ap-05",
      bill: "BIL-0752",
      vendor: "Ariba Print & Signage",
      due: "15 Sep",
      amount: 690_000,
      matched: "Unmatched",
      status: "On hold",
      tone: "error",
    },
    {
      id: "ap-06",
      bill: "BIL-0749",
      vendor: "Harmattan Power Systems",
      due: "12 Oct",
      amount: 8_150_000,
      matched: "PO + GRN",
      status: "Approved",
      tone: "primary",
    },
    {
      id: "ap-07",
      bill: "BIL-0745",
      vendor: "Kaduna Safety Equipment",
      due: "8 Oct",
      amount: 1_425_000,
      matched: "PO only",
      status: "Awaiting GRN",
      tone: "warning",
    },
  ],
  budgets: [
    {
      id: "bd-01",
      name: "Delivery — subcontract",
      owner: "Ngozi Okafor",
      budget: 48_000_000,
      spent: 39_360_000,
      percent: 82,
    },
    {
      id: "bd-02",
      name: "Engineering — tooling",
      owner: "Tunde Balogun",
      budget: 16_000_000,
      spent: 9_120_000,
      percent: 57,
    },
    {
      id: "bd-03",
      name: "Facilities — maintenance",
      owner: "Segun Adeyemi",
      budget: 12_500_000,
      spent: 11_875_000,
      percent: 95,
    },
    {
      id: "bd-04",
      name: "Commercial — travel",
      owner: "Chiamaka Eze",
      budget: 9_000_000,
      spent: 4_050_000,
      percent: 45,
    },
    {
      id: "bd-05",
      name: "People — learning",
      owner: "Hauwa Lawal",
      budget: 7_200_000,
      spent: 5_040_000,
      percent: 70,
    },
    {
      id: "bd-06",
      name: "Operations — logistics",
      owner: "Ibrahim Sule",
      budget: 21_000_000,
      spent: 22_260_000,
      percent: 106,
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Elevate Admin                                                      */
/* ------------------------------------------------------------------ */

export interface AssetRow {
  id: string;
  tag: string;
  item: string;
  category: string;
  /** Who holds it. "Unassigned" rather than an empty string. */
  assignee: string;
  location: string;
  status: string;
  tone: StatusTone;
}

export interface ApprovalRow {
  id: string;
  ref: string;
  title: string;
  requester: string;
  /** Where it sits in the matrix, e.g. "2 of 3 — Finance". */
  stage: string;
  amount: number;
  status: string;
  tone: StatusTone;
}

export interface ComplianceRow {
  id: string;
  policy: string;
  owner: string;
  reviewDue: string;
  /** Percentage of staff who have attested. */
  acknowledged: number;
  status: string;
  tone: StatusTone;
}

export interface FacilityRequestRow {
  id: string;
  ref: string;
  type: string;
  raisedBy: string;
  location: string;
  priority: "Urgent" | "High" | "Normal" | "Low";
  status: string;
  tone: StatusTone;
}

export interface AdminData {
  kpis: KpiItem[];
  assets: AssetRow[];
  approvals: ApprovalRow[];
  compliance: ComplianceRow[];
  requests: FacilityRequestRow[];
}

export const ADMIN_DATA: AdminData = {
  kpis: [
    { label: "Assets tracked", value: "486", delta: "+12", trend: "up", icon: Boxes },
    { label: "Approvals waiting", value: "9", delta: "-3", trend: "down", icon: ClipboardCheck },
    { label: "Open requests", value: "17", trend: "flat", icon: Wrench },
    { label: "Policies live", value: "31", delta: "+1", trend: "up", icon: Gavel },
  ],
  assets: [
    {
      id: "as-01",
      tag: "LT-0148",
      item: "Field laptop, 14in",
      category: "IT equipment",
      assignee: "Adaeze Nwosu",
      location: "Lagos — Yaba",
      status: "Issued",
      tone: "success",
    },
    {
      id: "as-02",
      tag: "LT-0132",
      item: "Field laptop, 14in",
      category: "IT equipment",
      assignee: "Zainab Yusuf",
      location: "Abuja — Wuse",
      status: "Issued",
      tone: "success",
    },
    {
      id: "as-03",
      tag: "VH-0027",
      item: "Utility van",
      category: "Vehicles",
      assignee: "Operations pool",
      location: "Lagos — Apapa",
      status: "In service",
      tone: "primary",
    },
    {
      id: "as-04",
      tag: "GN-0009",
      item: "Standby generator, 60kVA",
      category: "Plant",
      assignee: "Unassigned",
      location: "Lagos — Yaba",
      status: "Maintenance due",
      tone: "warning",
    },
    {
      id: "as-05",
      tag: "AC-2291",
      item: "Access card",
      category: "Access",
      assignee: "Adaeze Nwosu",
      location: "Lagos — Yaba",
      status: "Issued",
      tone: "success",
    },
    {
      id: "as-06",
      tag: "DK-0411",
      item: "Height-adjustable desk",
      category: "Furniture",
      assignee: "Unassigned",
      location: "Port Harcourt",
      status: "In store",
      tone: "neutral",
    },
    {
      id: "as-07",
      tag: "LT-0091",
      item: "Field laptop, 14in",
      category: "IT equipment",
      assignee: "Unassigned",
      location: "Lagos — Yaba",
      status: "Awaiting wipe",
      tone: "warning",
    },
    {
      id: "as-08",
      tag: "SM-0203",
      item: "Site survey meter",
      category: "Instruments",
      assignee: "Oluwaseun Ajayi",
      location: "Kano",
      status: "Calibration overdue",
      tone: "error",
    },
    {
      id: "as-09",
      tag: "PR-0056",
      item: "Multifunction printer",
      category: "IT equipment",
      assignee: "Facilities",
      location: "Abuja — Wuse",
      status: "In service",
      tone: "primary",
    },
  ],
  approvals: [
    {
      id: "ap-01",
      ref: "REQ-0884",
      title: "Replacement laptops, batch of 6",
      requester: "Tunde Balogun",
      stage: "Cleared — 3 of 3",
      amount: 7_200_000,
      status: "Approved",
      tone: "success",
    },
    {
      id: "ap-02",
      ref: "REQ-0891",
      title: "Generator servicing contract, 12 months",
      requester: "Segun Adeyemi",
      stage: "2 of 3 — Finance",
      amount: 4_800_000,
      status: "In review",
      tone: "info",
    },
    {
      id: "ap-03",
      ref: "REQ-0893",
      title: "Port Harcourt office fit-out",
      requester: "Ibrahim Sule",
      stage: "1 of 3 — Department head",
      amount: 18_400_000,
      status: "Awaiting",
      tone: "warning",
    },
    {
      id: "ap-04",
      ref: "REQ-0895",
      title: "Safety equipment restock",
      requester: "Oluwaseun Ajayi",
      stage: "1 of 2 — Department head",
      amount: 1_425_000,
      status: "Awaiting",
      tone: "warning",
    },
    {
      id: "ap-05",
      ref: "REQ-0879",
      title: "Fleet insurance renewal",
      requester: "Ngozi Okafor",
      stage: "Cleared — 2 of 2",
      amount: 6_950_000,
      status: "Approved",
      tone: "success",
    },
    {
      id: "ap-06",
      ref: "REQ-0888",
      title: "Additional cloud capacity",
      requester: "Emeka Obi",
      stage: "Returned — 2 of 3",
      amount: 3_100_000,
      status: "Sent back",
      tone: "error",
    },
    {
      id: "ap-07",
      ref: "REQ-0897",
      title: "Quarterly stationery order",
      requester: "Hauwa Lawal",
      stage: "1 of 2 — Department head",
      amount: 640_000,
      status: "Awaiting",
      tone: "warning",
    },
  ],
  compliance: [
    {
      id: "cp-01",
      policy: "Information Security Policy v4",
      owner: "Emeka Obi",
      reviewDue: "1 Mar 2027",
      acknowledged: 88,
      status: "Attestation open",
      tone: "info",
    },
    {
      id: "cp-02",
      policy: "Health & Safety Handbook",
      owner: "Segun Adeyemi",
      reviewDue: "12 Jan 2027",
      acknowledged: 96,
      status: "Current",
      tone: "success",
    },
    {
      id: "cp-03",
      policy: "Anti-Bribery & Gifts",
      owner: "Fatima Bello",
      reviewDue: "30 Nov 2026",
      acknowledged: 91,
      status: "Current",
      tone: "success",
    },
    {
      id: "cp-04",
      policy: "Data Retention Schedule",
      owner: "Zainab Yusuf",
      reviewDue: "2 Oct 2026",
      acknowledged: 64,
      status: "Review due",
      tone: "warning",
    },
    {
      id: "cp-05",
      policy: "Remote Working Standard",
      owner: "Hauwa Lawal",
      reviewDue: "18 Sep 2026",
      acknowledged: 72,
      status: "Overdue review",
      tone: "error",
    },
    {
      id: "cp-06",
      policy: "Procurement Code of Conduct",
      owner: "Musa Danjuma",
      reviewDue: "5 Feb 2027",
      acknowledged: 83,
      status: "Attestation open",
      tone: "info",
    },
  ],
  requests: [
    {
      id: "rq-01",
      ref: "FR-1204",
      type: "Power",
      raisedBy: "Chiamaka Eze",
      location: "Lagos — Yaba",
      priority: "Urgent",
      status: "Engineer assigned",
      tone: "info",
    },
    {
      id: "rq-02",
      ref: "FR-1201",
      type: "Air conditioning",
      raisedBy: "Kelechi Anyanwu",
      location: "Abuja — Wuse",
      priority: "High",
      status: "Parts ordered",
      tone: "warning",
    },
    {
      id: "rq-03",
      ref: "FR-1198",
      type: "Access card",
      raisedBy: "Adaeze Nwosu",
      location: "Lagos — Yaba",
      priority: "Normal",
      status: "Closed",
      tone: "success",
    },
    {
      id: "rq-04",
      ref: "FR-1196",
      type: "Plumbing",
      raisedBy: "Blessing Idowu",
      location: "Port Harcourt",
      priority: "High",
      status: "In progress",
      tone: "primary",
    },
    {
      id: "rq-05",
      ref: "FR-1193",
      type: "Desk move",
      raisedBy: "Musa Danjuma",
      location: "Lagos — Apapa",
      priority: "Low",
      status: "Scheduled",
      tone: "neutral",
    },
    {
      id: "rq-06",
      ref: "FR-1189",
      type: "Network point",
      raisedBy: "Amara Okonkwo",
      location: "Kano",
      priority: "Normal",
      status: "Awaiting vendor",
      tone: "warning",
    },
    {
      id: "rq-07",
      ref: "FR-1185",
      type: "Lighting",
      raisedBy: "Ibrahim Sule",
      location: "Abuja — Wuse",
      priority: "Low",
      status: "Closed",
      tone: "success",
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Elevate Projects                                                   */
/* ------------------------------------------------------------------ */

export interface BoardCard {
  id: string;
  ref: string;
  title: string;
  assignee: string;
  /** Fixed date label, e.g. "Due 26 Sep". */
  due: string;
  points: number;
  tag: string;
}

export interface BoardColumn {
  key: string;
  title: string;
  cards: BoardCard[];
}

export interface SprintSummary {
  name: string;
  window: string;
  committed: number;
  completed: number;
  /** Points added after the sprint started — the honest scope-creep number. */
  scopeAdded: number;
  /** Points remaining, day by day. */
  burndown: BarDatum[];
}

export interface WorkloadRow {
  id: string;
  person: string;
  role: string;
  /** Hours assigned this week. */
  assigned: number;
  /** Hours available this week. */
  capacity: number;
  /** assigned / capacity, pre-computed as a percentage. */
  utilisation: number;
}

export interface RiskRow {
  id: string;
  ref: string;
  title: string;
  owner: string;
  impact: "High" | "Medium" | "Low";
  likelihood: "High" | "Medium" | "Low";
  status: string;
  tone: StatusTone;
}

export interface ProjectsData {
  kpis: KpiItem[];
  board: BoardColumn[];
  sprint: SprintSummary;
  workload: WorkloadRow[];
  risks: RiskRow[];
}

export const PROJECTS_DATA: ProjectsData = {
  kpis: [
    { label: "Active projects", value: "14", delta: "+2", trend: "up", icon: SquareKanban },
    { label: "Tasks in flight", value: "168", delta: "-9", trend: "down", icon: ListChecks },
    { label: "Billable hours", value: "1,240", delta: "+6.5%", trend: "up", icon: Timer },
    { label: "Overdue", value: "11", delta: "+3", trend: "up", icon: Hourglass },
  ],
  board: [
    {
      key: "backlog",
      title: "Backlog",
      cards: [
        {
          id: "bc-01",
          ref: "MER-142",
          title: "Survey the Kano substation",
          assignee: "Oluwaseun Ajayi",
          due: "Due 2 Oct",
          points: 5,
          tag: "Meridian",
        },
        {
          id: "bc-02",
          ref: "MER-146",
          title: "Draft the handover pack",
          assignee: "Ngozi Okafor",
          due: "Due 6 Oct",
          points: 3,
          tag: "Meridian",
        },
        {
          id: "bc-03",
          ref: "HBL-088",
          title: "Depot access schedule",
          assignee: "Ibrahim Sule",
          due: "Due 9 Oct",
          points: 2,
          tag: "Harbourline",
        },
      ],
    },
    {
      key: "in-progress",
      title: "In progress",
      cards: [
        {
          id: "bc-04",
          ref: "MER-131",
          title: "Cable run, block C",
          assignee: "Emeka Obi",
          due: "Due 26 Sep",
          points: 8,
          tag: "Meridian",
        },
        {
          id: "bc-05",
          ref: "MER-135",
          title: "Commission the metering rack",
          assignee: "Adaeze Nwosu",
          due: "Due 29 Sep",
          points: 5,
          tag: "Meridian",
        },
        {
          id: "bc-06",
          ref: "HBL-081",
          title: "Fleet telemetry rollout",
          assignee: "Tunde Balogun",
          due: "Due 30 Sep",
          points: 8,
          tag: "Harbourline",
        },
        {
          id: "bc-07",
          ref: "DLT-054",
          title: "Clinic network survey",
          assignee: "Zainab Yusuf",
          due: "Due 1 Oct",
          points: 3,
          tag: "Delta",
        },
      ],
    },
    {
      key: "review",
      title: "In review",
      cards: [
        {
          id: "bc-08",
          ref: "MER-128",
          title: "As-built drawings, block B",
          assignee: "Ngozi Okafor",
          due: "Due 24 Sep",
          points: 3,
          tag: "Meridian",
        },
        {
          id: "bc-09",
          ref: "HBL-076",
          title: "Depot safety sign-off",
          assignee: "Segun Adeyemi",
          due: "Due 25 Sep",
          points: 2,
          tag: "Harbourline",
        },
        {
          id: "bc-10",
          ref: "ORL-032",
          title: "Line 3 uptime report",
          assignee: "Amara Okonkwo",
          due: "Due 27 Sep",
          points: 5,
          tag: "Orile",
        },
      ],
    },
    {
      key: "done",
      title: "Done",
      cards: [
        {
          id: "bc-11",
          ref: "MER-119",
          title: "Site induction for the rollout team",
          assignee: "Kelechi Anyanwu",
          due: "Closed 18 Sep",
          points: 2,
          tag: "Meridian",
        },
        {
          id: "bc-12",
          ref: "MER-121",
          title: "Cable run, block A",
          assignee: "Emeka Obi",
          due: "Closed 19 Sep",
          points: 8,
          tag: "Meridian",
        },
        {
          id: "bc-13",
          ref: "DLT-049",
          title: "Clinic asset register import",
          assignee: "Zainab Yusuf",
          due: "Closed 22 Sep",
          points: 5,
          tag: "Delta",
        },
      ],
    },
  ],
  sprint: {
    name: "Meridian — Sprint 14",
    window: "15–26 Sep",
    committed: 62,
    completed: 41,
    scopeAdded: 8,
    burndown: [
      { label: "D1", value: 62 },
      { label: "D2", value: 58 },
      { label: "D3", value: 55 },
      { label: "D4", value: 55 },
      { label: "D5", value: 47 },
      { label: "D6", value: 44 },
      { label: "D7", value: 38 },
      { label: "D8", value: 34 },
      { label: "D9", value: 29 },
      { label: "D10", value: 21 },
    ],
  },
  workload: [
    {
      id: "wl-01",
      person: "Emeka Obi",
      role: "Lead Engineer",
      assigned: 41,
      capacity: 40,
      utilisation: 103,
    },
    {
      id: "wl-02",
      person: "Adaeze Nwosu",
      role: "Field Engineer",
      assigned: 24,
      capacity: 30,
      utilisation: 80,
    },
    {
      id: "wl-03",
      person: "Tunde Balogun",
      role: "Platform Engineer",
      assigned: 36,
      capacity: 40,
      utilisation: 90,
    },
    {
      id: "wl-04",
      person: "Ngozi Okafor",
      role: "Delivery Manager",
      assigned: 32,
      capacity: 40,
      utilisation: 80,
    },
    {
      id: "wl-05",
      person: "Zainab Yusuf",
      role: "Data Analyst",
      assigned: 18,
      capacity: 40,
      utilisation: 45,
    },
    {
      id: "wl-06",
      person: "Oluwaseun Ajayi",
      role: "Site Supervisor",
      assigned: 38,
      capacity: 40,
      utilisation: 95,
    },
    {
      id: "wl-07",
      person: "Amara Okonkwo",
      role: "QA Engineer",
      assigned: 12,
      capacity: 20,
      utilisation: 60,
    },
  ],
  risks: [
    {
      id: "rk-01",
      ref: "RSK-018",
      title: "Substation access depends on a third-party permit",
      owner: "Ngozi Okafor",
      impact: "High",
      likelihood: "Medium",
      status: "Mitigating",
      tone: "warning",
    },
    {
      id: "rk-02",
      ref: "RSK-021",
      title: "Cable stock short by 400m for block D",
      owner: "Musa Danjuma",
      impact: "Medium",
      likelihood: "High",
      status: "Escalated",
      tone: "error",
    },
    {
      id: "rk-03",
      ref: "RSK-014",
      title: "Lead engineer over capacity two sprints running",
      owner: "Ngozi Okafor",
      impact: "Medium",
      likelihood: "Medium",
      status: "Mitigating",
      tone: "warning",
    },
    {
      id: "rk-04",
      ref: "RSK-009",
      title: "Rainy-season delay to the Port Harcourt fit-out",
      owner: "Ibrahim Sule",
      impact: "Low",
      likelihood: "High",
      status: "Accepted",
      tone: "neutral",
    },
    {
      id: "rk-05",
      ref: "RSK-023",
      title: "Client sign-off window narrows over the holiday",
      owner: "Chiamaka Eze",
      impact: "Medium",
      likelihood: "Low",
      status: "Watching",
      tone: "info",
    },
    {
      id: "rk-06",
      ref: "RSK-006",
      title: "Telemetry vendor contract expires mid-rollout",
      owner: "Tunde Balogun",
      impact: "High",
      likelihood: "Low",
      status: "Closed",
      tone: "success",
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Titles                                                             */
/* ------------------------------------------------------------------ */

/**
 * What the shell's top bar calls each preview module's landing page. Kept here
 * rather than in the shell so a dashboard agent can rename its page without
 * editing a component it does not own.
 */
export const SUITE_PAGE_TITLE: Record<PreviewSlug, string> = {
  hrm: "People overview",
  finance: "Finance overview",
  admin: "Administration overview",
  projects: "Delivery overview",
};
