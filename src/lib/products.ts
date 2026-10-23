import {
  ArrowLeftRight,
  BadgeCheck,
  Banknote,
  Bell,
  Bot,
  Building2,
  CalendarCheck,
  ClipboardCheck,
  ClipboardList,
  Coins,
  Columns3,
  FileSpreadsheet,
  FlaskConical,
  FolderTree,
  Gauge,
  GraduationCap,
  IdCard,
  Inbox,
  Landmark,
  LogOut,
  MonitorPlay,
  Package,
  Palette,
  PiggyBank,
  Plane,
  Route,
  ScrollText,
  Share2,
  ShieldCheck,
  ShoppingBag,
  SquareKanban,
  Target,
  TrendingUp,
  Trophy,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from "lucide-react";

/**
 * The product registry.
 *
 * XwiftHQ is five modules on one spine, and this file is the only place that
 * knows what the five are. Navigation, the footer, the platform page and all
 * five product pages derive from it, so a product's name, hue, route and
 * capabilities are edited here once, not in nine places that will drift.
 *
 * The prose in here is the substance of five marketing pages. Treat it as
 * copy, not as configuration: it is written, reviewed and read by people.
 */

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ProductSlug = "lms" | "hrm" | "finance" | "admin" | "projects";

/**
 * A product's hue is a label, not a theme; see the comment on HUE below.
 */
export type ProductHue = "primary" | "violet" | "accent" | "neutral" | "info";

export interface ProductHueTokens {
  /** Tinted tile background, e.g. "bg-violet-500/10". */
  tile: string;
  /** Icon colour on the tile. Contrast-checked: gold resolves to accent-600. */
  icon: string;
  /** Text colour, for eyebrows only. Gold resolves to accent-700. */
  text: string;
  /** Hairline / rule, e.g. "bg-violet-500". */
  rule: string;
  /** Border for outlined surfaces, e.g. "border-violet-500/25". */
  border: string;
  /** Raw hex, for inline SVG fills and strokes only. */
  hex: string;
}

export interface ProductCapability {
  /** Sub-area, e.g. "Payroll". */
  group: string;
  /** 4 to 7 concrete capabilities in that sub-area. */
  items: string[];
}

export interface ProductPillar {
  icon: LucideIcon;
  title: string;
  description: string;
}

export interface ProductFlow {
  /** e.g. "Hire → productive" */
  title: string;
  /** Ordered steps, each naming the module that acts. */
  steps: { module: ProductSlug; action: string }[];
}

export interface Product {
  slug: ProductSlug;
  /** Exact product name, e.g. "XwiftHQ HRM". */
  name: string;
  /** Name without the "XwiftHQ " prefix, for tight spaces. */
  shortName: string;
  /** One line, sentence case, no full stop. Used under the name on cards. */
  tagline: string;
  /** 1 to 2 sentences. Card body and meta description seed. */
  summary: string;
  icon: LucideIcon;
  hue: ProductHue;
  /** Marketing route, e.g. "/products/hrm". */
  href: string;
  /**
   * In-app route: the module's console ("/suite/finance", "/suite/operations",
   * "/suite/hrm", "/suite/projects", "/suite/lms").
   */
  appHref: string;
  /**
   * True when the module runs against real data. All five are live (owner,
   * 9 October 2026); the flag stays because SuiteShell still reads it.
   */
  live: boolean;
  /** 6 pillars. */
  pillars: ProductPillar[];
  /** 6 to 8 capability groups. This is the depth of the product page. */
  capabilities: ProductCapability[];
  /** 4 headline figures for the product page stat strip. */
  stats: { label: string; value: string; note?: string }[];
  /** How this product meets the other four. 3 to 4 entries. */
  connections: { to: ProductSlug; description: string }[];
  /** 4 to 5 entries. */
  faqs: { question: string; answer: string }[];
}

/* ------------------------------------------------------------------ */
/*  Hues                                                               */
/* ------------------------------------------------------------------ */

/**
 * The five hues, and the only four places a hue is allowed to appear: an icon
 * tile, an eyebrow rule, a chart accent inside the product's own surfaces, and
 * the active nav state inside its own app shell.
 *
 * Teal leads and gold rewards. If Finance recoloured its buttons gold and
 * Projects recoloured its buttons sky, XwiftHQ would stop reading as one
 * company, so every primary CTA on the site stays teal regardless of which
 * product's page it sits on. The hue is a *label*, not a theme.
 *
 * Note the asymmetry on `accent`, and do not "tidy" it away: every other hue
 * uses one value for `icon` and `text` because one value clears both bars.
 * Summit Gold does not. #E6A532 on white is 2.14:1, unusable for anything.
 * accent-600 reaches 3.4:1, which clears the non-text threshold a glyph is
 * judged against; accent-700 reaches 5.5:1, which is what *text* needs. Using
 * one value for both would look tidier and ship a WCAG failure in whichever
 * direction it was unified. `products.test.ts` pins both values for that
 * reason. The same rule is why `neutral` is ink rather than a fifth colour:
 * Admin is the chassis, and its restraint is the point.
 */
export const HUE: Record<ProductHue, ProductHueTokens> = {
  primary: {
    tile: "bg-primary-500/10",
    icon: "text-primary-600",
    text: "text-primary-700",
    rule: "bg-primary-600",
    border: "border-primary-500/25",
    hex: "#9638CD",
  },
  violet: {
    tile: "bg-violet-500/10",
    icon: "text-violet-600",
    text: "text-violet-700",
    rule: "bg-violet-500",
    border: "border-violet-500/25",
    hex: "#B02F74",
  },
  accent: {
    tile: "bg-accent-500/15",
    icon: "text-accent-600",
    text: "text-accent-700",
    rule: "bg-accent-500",
    border: "border-accent-500/30",
    hex: "#E6A532",
  },
  neutral: {
    tile: "bg-neutral-900/8",
    icon: "text-neutral-700",
    text: "text-neutral-700",
    rule: "bg-neutral-700",
    border: "border-neutral-300",
    hex: "#363A4B",
  },
  info: {
    tile: "bg-info-500/10",
    icon: "text-info-600",
    text: "text-info-600",
    rule: "bg-info-500",
    border: "border-info-500/25",
    hex: "#0369A1",
  },
};

/* ------------------------------------------------------------------ */
/*  The five products                                                  */
/* ------------------------------------------------------------------ */

/*
  Owner, 9 October 2026: "This is not a student portal. This is a company
  all-in-one suite." and "All modules have been completely done." Every entry
  below is live, and every capability line is something a reader can find in
  the running app; the copy was rewritten against what is built (Finance and
  Admin & Operations through Phase 4, HRM's thirteen tranches, Projects with
  testing and project financials, Learning as workforce training). If a line
  stops being true, cut it rather than soften it.
*/

const FINANCE: Product = {
  slug: "finance",
  name: "XwiftHQ Finance",
  shortName: "Finance",
  tagline: "The ledger, spend control and reporting you close your books on",
  summary:
    "Run your general ledger, banking and reconciliation, spend-to-pay (payment vouchers and withholding tax included), revenue and receivables, budgets, project funds and fixed assets in one place. Payroll, purchases and trips post to the same books, so month-end is a review, not a rebuild.",
  icon: Wallet,
  hue: "accent",
  href: "/products/finance",
  appHref: "/suite/finance",
  live: true,
  pillars: [
    {
      icon: Landmark,
      title: "Books that actually close",
      description:
        "Start from a chart-of-accounts template. Post journals, set the repeating ones to recur, and lock each period when you close it. Your trial balance, income statement, financial position and cash flow come straight from posted entries.",
    },
    {
      icon: ClipboardCheck,
      title: "Every payment checked first",
      description:
        "Payment and advance memos clear the finance control unit's checks, then become payment vouchers with withholding tax worked out. They leave as a payment schedule and a bank file. Advances get retired against receipts, never forgotten.",
    },
    {
      icon: ArrowLeftRight,
      title: "Reconciliation that runs on your rules",
      description:
        "Import a bank statement and let your own rules match the obvious lines. You review only what's left. Reconciliation reports show what was matched, who matched it and what's still open.",
    },
    {
      icon: PiggyBank,
      title: "Project funds, kept in check",
      description:
        "Give each project a budget by category and month, released in tranches. Commitments count the moment a purchase or trip is approved, so no project can spend money it was never released.",
    },
    {
      icon: Gauge,
      title: "Budgets that push back",
      description:
        "Budget controls warn on, or block, any voucher that would overrun its line. The cash forecast reads the same commitments, so the money you expect to need is the money you planned.",
    },
    {
      icon: FileSpreadsheet,
      title: "One report, the whole company",
      description:
        "Print the company finance report as a PDF on your letterhead with a QR check, or take it as Excel. It covers every analysis for a period, right down to who raised each request.",
    },
  ],
  capabilities: [
    {
      group: "Ledger & close",
      items: [
        "Chart of accounts from a starter template, mapped to your cost centres",
        "Manual and recurring journals, with approval",
        "Accounting periods you close and lock",
        "Trial balance, income statement, financial position and cash flow",
        "Payroll journals from HRM, posted by cost centre",
        "Drill down from any figure to the entries behind it",
      ],
    },
    {
      group: "Banking & reconciliation",
      items: [
        "Bank accounts with maker-checker on any change to their details",
        "Statement import, reviewed before anything posts",
        "Matching rules you write once and reuse",
        "Reconciliation reports by account and period",
        "Payment schedules and bank payment files",
      ],
    },
    {
      group: "Spend to pay",
      items: [
        "Payment memos and staff advance memos",
        "Finance control unit checks before any voucher is raised",
        "Payment vouchers with withholding tax calculated",
        "Advances retired against receipts",
        "Step-up sign-in check on high-value approvals",
        "Every step runs on the suite's approval engine",
      ],
    },
    {
      group: "Revenue & receivables",
      items: [
        "Client contracts, invoices and receipts",
        "Retention held and released against the contract",
        "Multi-currency with dated exchange rates",
        "Aged receivables and client statements",
        "Client advances applied to later invoices",
        "Voids that record who, when and why",
      ],
    },
    {
      group: "Projects & portfolio",
      items: [
        "Project budgets by category and month",
        "Tranche releases, plus commitments from approved spend",
        "Labour cost from logged hours and payroll",
        "Expected against actual expense on every project",
        "Portfolio view with RAG status and earned value",
      ],
    },
    {
      group: "Budgets & cash",
      items: [
        "Company budgets by cost centre, with approval",
        "Controls that warn on or block an overrunning voucher",
        "Budget against actual, line by line",
        "Cash forecast from commitments and expected receipts",
      ],
    },
    {
      group: "Tax, assets & reporting",
      items: [
        "Withholding tax remittance and certificates",
        "Fixed asset books with monthly depreciation and disposal",
        "Assets booked the moment their payment voucher is approved",
        "Company finance report as a branded PDF and Excel",
        "Every posting recorded in the shared audit trail",
      ],
    },
  ],
  stats: [
    {
      label: "Financial statements",
      value: "4",
      note: "Trial balance, income statement, financial position and cash flow",
    },
    {
      label: "Spend to pay",
      value: "Memo → bank",
      note: "Control checks, voucher, WHT, schedule and bank file",
    },
    {
      label: "Project funds",
      value: "By month",
      note: "Budgets, tranche releases and commitments",
    },
    {
      label: "Company report",
      value: "PDF + Excel",
      note: "Every analysis for a period, down to the requester",
    },
  ],
  connections: [
    {
      to: "admin",
      description:
        "Purchases, trips and events approved in Admin & Operations land as commitments against the right budget. Each invoice is matched to its order and goods received before a voucher is raised.",
    },
    {
      to: "hrm",
      description:
        "Each payroll run posts its journal by cost centre, and net pay leaves on a bank file. A leaver's final pay waits until Finance shows no unretired advance against them.",
    },
    {
      to: "projects",
      description:
        "Every project shows its budget, releases and spend on the project itself, next to labour cost from logged hours. Expected against actual, no export needed.",
    },
    {
      to: "lms",
      description:
        "Training spend sits on the same books as everything else, so the cost of a compliance programme is a line in the company report, not a guess.",
    },
  ],
  faqs: [
    {
      question: "Is XwiftHQ Finance available now?",
      answer:
        "Yes. The ledger, banking, spend-to-pay, revenue, budgets, project funds, fixed assets and the company report all run on real data today.",
    },
    {
      question: "Do we need a separate accounting system?",
      answer:
        "No. Finance is a full general ledger with periods, close and all four financial statements. Payroll, purchasing and travel post straight into it, so there's nothing to import at month-end.",
    },
    {
      question: "Who approves a payment?",
      answer:
        "Whoever your approval workflow names. Finance runs on the suite's approval engine, so you set levels, amount bands and delegation once for your organisation. High-value approvals ask for a second sign-in check.",
    },
    {
      question: "Can a closed period be changed?",
      answer:
        "Not quietly. A closed period is locked. Any correction goes in as a dated journal in an open period, and both the close and the correction land in the audit trail.",
    },
    {
      question: "Can we see what each project has really spent?",
      answer:
        "Yes. Every project shows its approved budget against actual spend (labour from logged hours, travel, events and purchases), and the company report rolls it all up.",
    },
  ],
};

const ADMIN: Product = {
  slug: "admin",
  name: "XwiftHQ Admin",
  shortName: "Admin",
  tagline: "Admin & Operations for buying, travel, assets, stores, fleet and facilities",
  summary:
    "Procurement from requisition to goods received, the travel desk, events, the asset register, stores and stock, maintenance, facilities, fleet, the service desk, compliance and controlled documents. Everything it takes to run your company day to day, on the same approvals and the same books.",
  icon: Building2,
  hue: "neutral",
  href: "/products/admin",
  appHref: "/suite/operations",
  live: true,
  pillars: [
    {
      icon: ShoppingBag,
      title: "From requisition to goods received",
      description:
        "A purchase request gathers quotations, gets awarded, becomes a purchase order and is received on a GRN or a service completion certificate. The invoice that follows is matched against all of it.",
    },
    {
      icon: Plane,
      title: "A travel desk that follows policy",
      description:
        "Trips are priced against travel grades, and advances go in with the request. Bookings and changes are recorded, and the trip report closes the loop. Events and workshops carry budgets of their own.",
    },
    {
      icon: Package,
      title: "Know who holds every asset",
      description:
        "Register, tag and hand over assets with a note the receiver acknowledges. With gate passes, verification counts and exit clearance, a leaver's laptop is a line on a list, not a hunt.",
    },
    {
      icon: Wrench,
      title: "Stores, maintenance and fleet",
      description:
        "Stock ledgers, requisitions, counts approved by a second person and reorder alerts. Maintenance plans and work orders. Vehicles with their papers and bookings.",
    },
    {
      icon: ShieldCheck,
      title: "Compliance on a clock",
      description:
        "A compliance calendar for filings, licences and renewals. A bid pack you download in one go. Controlled documents with versions, owners and disposal on approval.",
    },
    {
      icon: Inbox,
      title: "One front desk",
      description:
        "A service desk for internal requests, a correspondence register, visitor pre-registration and a document repository. The things every office runs, in the same place as everything else.",
    },
  ],
  capabilities: [
    {
      group: "Procurement",
      items: [
        "Purchase requisitions, with optional attachments",
        "Quotations per vendor, compared and awarded",
        "Purchase orders raised from the award",
        "Goods received notes and service completion certificates",
        "Invoices matched to order and receipt",
        "Vendors shared with Finance as counterparties",
      ],
    },
    {
      group: "Travel & events",
      items: [
        "Travel policy grades and allowances",
        "Trip requests with advances",
        "Bookings, changes and trip reports",
        "One travel calendar for the whole organisation",
        "Events, workshops and engagements with their own budgets",
        "Charged to a project or cost centre at request",
      ],
    },
    {
      group: "Assets",
      items: [
        "Asset register with categories and tags",
        "Handover notes the receiver acknowledges",
        "Asset requests and gate passes",
        "Periodic verification",
        "Exit clearance that feeds deductions into final pay",
      ],
    },
    {
      group: "Stores & stock",
      items: [
        "Items, stores and a stock ledger",
        "Staff requisitions issued against acknowledgement",
        "Stock counts approved by a second person",
        "Reorder levels with alerts",
        "Consumption reporting",
      ],
    },
    {
      group: "Maintenance, facilities & fleet",
      items: [
        "Maintenance plans by time, usage or both",
        "Work orders that check warranty before a paid repair",
        "Leases, utilities and service contracts",
        "Fleet register with vehicle papers and renewal dates",
        "Vehicle bookings and a diesel log",
      ],
    },
    {
      group: "Service desk & front office",
      items: [
        "Service catalogue and tickets",
        "Reported faults become work orders",
        "Correspondence register, in and out",
        "Visitor pre-registration",
        "Client payment requests raised for Finance",
      ],
    },
    {
      group: "Compliance & documents",
      items: [
        "Compliance calendar showing due and overdue obligations",
        "Bid pack downloaded as one file",
        "Document repository shared across the suite",
        "Controlled documents with versions and owners",
        "Controlled documents disposed of on approval",
        "Staff policies read and acknowledged from My space",
      ],
    },
  ],
  stats: [
    {
      label: "Procurement chain",
      value: "PR → GRN",
      note: "Quotations, award, order, receipt and matched invoice",
    },
    {
      label: "Registers",
      value: "Assets · Stock · Fleet",
      note: "Plus leases, contracts and correspondence",
    },
    {
      label: "Exit clearance",
      value: "Into final pay",
      note: "Unreturned items become deductions automatically",
    },
    {
      label: "Compliance",
      value: "Calendar",
      note: "Filings, licences and vehicle papers, with due dates",
    },
  ],
  connections: [
    {
      to: "finance",
      description:
        "Purchases, trips and events commit against their budget the moment they're approved. Invoices reach Finance already matched to the order and goods received.",
    },
    {
      to: "hrm",
      description:
        "Joiners get their assets on a handover note. Leavers clear them on exit clearance, and anything unreturned flows into HRM final pay as a deduction.",
    },
    {
      to: "projects",
      description:
        "Trips, events and purchases are charged to a project at request, so the project's Finance tab shows what was spent on it, and by whom.",
    },
    {
      to: "lms",
      description:
        "Policies published as controlled documents can sit next to a mandatory course, so staff read the policy and finish the training in one place.",
    },
  ],
  faqs: [
    {
      question: "Is XwiftHQ Admin & Operations available now?",
      answer:
        "Yes. Procurement, travel, events, assets, stores, maintenance, facilities, fleet, the service desk, compliance and documents all run on real data today.",
    },
    {
      question: "Is this the same as the organisation console?",
      answer:
        "No. The organisation console is where you set up the company: users, roles, structure, approval workflows, numbering and branding. Admin & Operations is where the daily running happens: buying, travelling, holding assets and keeping the office compliant.",
    },
    {
      question: "How are purchases approved?",
      answer:
        "On the suite's approval engine. You define the levels and amount bands once, approvers see every request in one inbox, and delegation covers anyone who's away.",
    },
    {
      question: "What happens to a leaver's assets?",
      answer:
        "They show up on the leaver's exit clearance. Anything not returned becomes a deduction in HRM final pay, and final pay stays blocked until the clearance is settled.",
    },
    {
      question: "Can we charge travel and events to a project?",
      answer:
        "Yes. Each request picks a project or cost centre, commits against its funds once approved, and appears in that project's expected-against-actual figures.",
    },
  ],
};

const HRM: Product = {
  slug: "hrm",
  name: "XwiftHQ HRM",
  shortName: "HRM",
  tagline: "Every employment event, from offer to final pay, on one record",
  summary:
    "Directory, onboarding, contracts, leave, attendance, rotas, timesheets, payroll with statutory deductions, recruitment, performance, employee relations and leavers. All on one employee record, with self-service for every member of staff.",
  icon: Users,
  hue: "violet",
  href: "/products/hrm",
  appHref: "/suite/hrm",
  live: true,
  pillars: [
    {
      icon: IdCard,
      title: "One employee record",
      description:
        "Create a person once. Contracts, documents with expiry dates, leave balances, pay, appraisals, cases and training all hang off that one record, so the answer never depends on which screen you asked.",
    },
    {
      icon: UserPlus,
      title: "From requisition to first day",
      description:
        "Vacancies start as requisitions. Candidates move through interviews to an offer, and an accepted offer becomes an onboarding journey with probation milestones and a contract.",
    },
    {
      icon: CalendarCheck,
      title: "Leave, rotas and time in sync",
      description:
        "Leave types with balances and carry-over, shift rotas with coverage, attendance and timesheets all feed each other. Approved overtime lands on the payslip, not in a spreadsheet.",
    },
    {
      icon: Banknote,
      title: "Payroll with statutory deductions built in",
      description:
        "Earnings and deduction elements, statutory deductions and payslips come from one run. The journal goes to Finance by cost centre, and net pay is paid on a bank file.",
    },
    {
      icon: Target,
      title: "Performance you can measure",
      description:
        "Goals, KPIs and milestones with real attainment, appraisal cycles, and compliance training shown right beside the review.",
    },
    {
      icon: LogOut,
      title: "Leavers, handled properly",
      description:
        "Exit interview, clearance checklist and final settlement. Final pay is held while assets are unreturned or advances unretired, so nobody leaves owing something the company forgot.",
    },
  ],
  capabilities: [
    {
      group: "People & records",
      items: [
        "Staff directory with org units and job titles",
        "Personal details, emergency contacts and documents with expiry dates",
        "Contracts issued, renewed and terminated",
        "Renewals board for contracts about to lapse",
        "Internship programmes",
        "Self-service for every member of staff",
      ],
    },
    {
      group: "Onboarding & probation",
      items: [
        "Onboarding programmes and individual journeys",
        "Reschedule, abandon or archive any journey",
        "Probation milestones and confirmation",
        "Assets handed over through Admin & Operations",
      ],
    },
    {
      group: "Leave, attendance & time",
      items: [
        "Leave types, balances, adjustments and carry-over",
        "Team leave calendar and approvals",
        "Shift rotas with coverage",
        "Attendance records",
        "Timesheets with approval",
        "Overtime paid through payroll",
      ],
    },
    {
      group: "Payroll",
      items: [
        "Earnings and deduction elements",
        "Statutory deductions applied on every run",
        "Payslips for every member of staff",
        "Journal posted to Finance by cost centre",
        "Net pay paid on a bank file from Finance",
      ],
    },
    {
      group: "Recruitment",
      items: [
        "Job requisitions on the approval engine",
        "Candidates and interview scheduling",
        "Offers, acceptance and hand-off to onboarding",
        "Recruitment pipeline by stage",
      ],
    },
    {
      group: "Performance",
      items: [
        "Goals, KPIs and milestones with attainment",
        "Every target that's due, in one view",
        "Appraisal cycles",
        "Compliance training shown beside the review",
      ],
    },
    {
      group: "Employee relations & leavers",
      items: [
        "Disciplinary cases that follow the process, stage by stage",
        "Grievances raised by staff directly",
        "Warnings that expire on a set date",
        "Exit interview and clearance checklist",
        "Final settlement blocked by unreturned assets or unretired advances",
        "Leavers' access revoked automatically",
      ],
    },
    {
      group: "Workforce analytics",
      items: [
        "Headcount, turnover and tenure",
        "Absence and leave liability",
        "Span of control",
        "CSV export for every analysis",
      ],
    },
  ],
  stats: [
    {
      label: "Employment lifecycle",
      value: "Offer → final pay",
      note: "One record from start to finish",
    },
    {
      label: "Payroll outputs",
      value: "3",
      note: "Payslips, ledger journal and bank file",
    },
    {
      label: "Self-service",
      value: "Every staff member",
      note: "Leave, payslips, documents, cases and notices",
    },
    {
      label: "Exit blockers",
      value: "2",
      note: "Unreturned assets and unretired advances hold final pay",
    },
  ],
  connections: [
    {
      to: "finance",
      description:
        "Each payroll run posts its journal by cost centre and is paid on a bank file. Unretired advances in Finance hold a leaver's final pay until they're cleared.",
    },
    {
      to: "admin",
      description:
        "Joiners get assets on a handover note. Leavers return them on exit clearance, and anything missing becomes a final-pay deduction with no re-keying.",
    },
    {
      to: "projects",
      description:
        "Project teams come from the same staff and job titles, so someone's role on a project and their HR record always describe the same person.",
    },
    {
      to: "lms",
      description:
        "Mandatory training and its due dates sit beside the employee record. Compliance shows up in the appraisal without moving a rating on its own.",
    },
  ],
  faqs: [
    {
      question: "Is XwiftHQ HRM available now?",
      answer:
        "Yes. Onboarding, contracts, probation, leave, attendance, rotas, timesheets, payroll, recruitment, performance, employee relations and leavers all run on real data today.",
    },
    {
      question: "How does payroll reach the accounts?",
      answer:
        "Each run produces payslips and a journal split by cost centre. Finance posts the journal to the general ledger and pays net pay on a bank file. No spreadsheet in between.",
    },
    {
      question: "Can managers approve leave without HR?",
      answer:
        "Yes. Supervisors see their own team and approve leave and timesheets. Your approval workflow decides who can approve what.",
    },
    {
      question: "What stops a leaver being paid while still holding a laptop?",
      answer:
        "Exit clearance. Unreturned assets from Admin & Operations and unretired advances from Finance both block final settlement until they're cleared or deducted.",
    },
    {
      question: "Is employee data isolated between organisations?",
      answer:
        "Yes. Every record is scoped to an organisation, and that boundary is enforced in the API, not just the interface.",
    },
  ],
};

const PROJECTS: Product = {
  slug: "projects",
  name: "XwiftHQ Projects",
  shortName: "Projects",
  tagline: "Plan, test and deliver projects, and know what they cost",
  summary:
    "Story boards, sprints, testing, schedules and the critical path, plus team performance, rate cards and a Finance tab that sets expected expense against actual. Clients follow along on a share link, and your team gets updates in Slack, WhatsApp or email.",
  icon: SquareKanban,
  hue: "info",
  href: "/products/projects",
  appHref: "/suite/projects",
  live: true,
  pillars: [
    {
      icon: Columns3,
      title: "Stories on a board",
      description:
        "Every card is a story, grouped by epic and linked to the sprint that delivers it. Import a backlog, plan the sprint, and see what's actually moving.",
    },
    {
      icon: Bot,
      title: "AI that plans with you",
      description:
        "The delivery planner drafts epics and stories from a brief. The assistant answers questions about the project. Test cases are drafted from each story for a person to accept.",
    },
    {
      icon: FlaskConical,
      title: "Testing built in",
      description:
        "QA sprints, a test-case library and runs per sprint. A failed test raises a finding with severity and steps to reproduce, and findings live as bugs on the same board.",
    },
    {
      icon: TrendingUp,
      title: "Performance from real sprints",
      description:
        "Velocity, variability and a delivery forecast based on what your team actually closed. The Excel export includes the money, for people allowed to see it.",
    },
    {
      icon: Coins,
      title: "Expected against actual",
      description:
        "Rate cards turn logged hours into labour cost. Travel, events and purchases charged to the project add the rest. The Finance tab sets it all against the approved budget.",
    },
    {
      icon: Share2,
      title: "Clients and channels",
      description:
        "Share a read-only view with a client by link. Send assignments and updates to Slack, WhatsApp, Gmail or Zoho Mail.",
    },
  ],
  capabilities: [
    {
      group: "Board & backlog",
      items: [
        "Story board with epics and swimlanes",
        "Backlog import",
        "Stories linked to sprints",
        "Bugs, tasks and stories on one board",
        "Comments, attachments and activity",
      ],
    },
    {
      group: "Planning & schedule",
      items: [
        "Sprints with capacity and commitment",
        "Schedule with dependencies and the critical path",
        "Project calendar",
        "Project charter",
        "AI delivery planner that works from a brief",
      ],
    },
    {
      group: "Testing",
      items: [
        "QA and security analyst roles",
        "Test sprints running beside delivery sprints",
        "Test-case library",
        "AI-drafted test cases for each story",
        "Findings with severity, steps and a recommendation",
      ],
    },
    {
      group: "Performance",
      items: [
        "Velocity and variability from closed sprints",
        "Delivery forecast",
        "Contribution per person",
        "Excel performance sheet",
      ],
    },
    {
      group: "Cost & finance",
      items: [
        "Rate cards per member",
        "Time logs costed at the rate card",
        "Finance tab: budget, releases, commitments and spend",
        "Expected against actual expense",
        "Budget drafted by the project manager, approved in Finance",
      ],
    },
    {
      group: "People & sharing",
      items: [
        "Project roles from your organisation's job titles",
        "Read-only client share links",
        "Stakeholders and documents per project",
        "AI assistant on the project's own data",
      ],
    },
    {
      group: "Integrations",
      items: [
        "Slack",
        "WhatsApp",
        "Gmail and Zoho Mail for outgoing email",
        "In-app notifications",
      ],
    },
  ],
  stats: [
    {
      label: "Delivery",
      value: "Board · Sprint · Schedule",
      note: "Stories, sprints and the critical path",
    },
    {
      label: "Testing",
      value: "Built in",
      note: "QA sprints, a case library and AI test cases",
    },
    {
      label: "Project money",
      value: "Expected vs actual",
      note: "Labour, travel, events and purchases",
    },
    {
      label: "Channels",
      value: "4",
      note: "Slack, WhatsApp, Gmail and Zoho Mail",
    },
  ],
  connections: [
    {
      to: "finance",
      description:
        "Budget, tranche releases and commitments come from Finance and sit on the project's own Finance tab, against labour cost from logged hours.",
    },
    {
      to: "admin",
      description:
        "Trips, events and purchases are charged to the project at request, so you see real spend without waiting for month-end.",
    },
    {
      to: "hrm",
      description:
        "Teams are staffed from HRM's people and job titles, so project roles and employment records always agree on who someone is.",
    },
    {
      to: "lms",
      description:
        "When a team needs a skill, the training that builds it is in the same suite, on the same sign-in.",
    },
  ],
  faqs: [
    {
      question: "Is XwiftHQ Projects available now?",
      answer:
        "Yes. Story boards, sprints, testing, schedules, performance, project finance, client share links and the Slack, WhatsApp and email integrations all run on real data today.",
    },
    {
      question: "Does every project need Finance?",
      answer:
        "No. Without Finance, you still get labour cost from logged hours at your rate cards. With it, every project also shows its approved budget, releases and real spend.",
    },
    {
      question: "Who can see the money?",
      answer:
        "Only people with the cost permission. Everyone else sees delivery figures (velocity, forecasts and progress) without rates or spend.",
    },
    {
      question: "Can clients follow a project?",
      answer:
        "Yes, through a read-only share link scoped to that project. They see the progress you choose to share, and nothing else.",
    },
    {
      question: "Does the AI decide anything on its own?",
      answer:
        "No. Planner output and test-case drafts are proposals a person accepts or edits. Nothing lands on the board unless someone chooses it.",
    },
  ],
};

const LMS: Product = {
  slug: "lms",
  name: "XwiftHQ LMS",
  shortName: "LMS",
  tagline: "Train your staff, prove compliance and issue certificates anyone can verify",
  summary:
    "Courses, learning paths and mandatory training with due dates for your staff. A compliance report shows who's overdue, and anyone can check a certificate by its serial. All branded as your company.",
  icon: GraduationCap,
  hue: "primary",
  href: "/products/lms",
  appHref: "/suite/lms",
  live: true,
  pillars: [
    {
      icon: ClipboardList,
      title: "Mandatory training, tracked",
      description:
        "Mark a course mandatory, set a due date and assign it to a person, a team or everyone. The compliance report shows who's done, who's due and who's overdue, and exports to CSV.",
    },
    {
      icon: Route,
      title: "A learning path for every role",
      description:
        "Put courses in order as a path and assign it in one action. Progress is measured against the path, so everyone knows their next step.",
    },
    {
      icon: MonitorPlay,
      title: "Video, article, document and quiz",
      description:
        "Build courses from any mix of lessons, using media from your own library. Quizzes support pass marks, attempt and time limits, question banks and shuffling.",
    },
    {
      icon: BadgeCheck,
      title: "Certificates that check out",
      description:
        "Every certificate carries a serial. Clients, auditors and regulators can check it without an account, and a revoked certificate says so.",
    },
    {
      icon: Trophy,
      title: "Progress you can see",
      description:
        "Badges at each quarter of a course and leaderboards scoped to your own organisation. Motivating inside a team, never a public ranking.",
    },
    {
      icon: Palette,
      title: "Your company's look",
      description:
        "Set a logo and accent colour per organisation. Contrast is checked as the admin types, so training never ships in a colour nobody can read.",
    },
  ],
  capabilities: [
    {
      group: "Courses",
      items: [
        "Curriculum builder with sections and lessons",
        "Video, article, document and quiz lessons",
        "Media library on your own storage",
        "Draft, review and publish under an approval policy",
        "Course reviews moderated before they appear",
      ],
    },
    {
      group: "Assignment & paths",
      items: [
        "Ordered learning paths",
        "Assign to one person, a team or everyone",
        "Withdraw an assignment and keep the progress",
        "Roster of who has started, stalled or finished",
        "Bulk staff import with one-time sign-in details",
      ],
    },
    {
      group: "Compliance",
      items: [
        "Mandatory courses with due dates",
        "Compliance report by person and course",
        "Overdue and due-soon views",
        "CSV export for audits",
        "Compliance shown in HRM appraisals",
      ],
    },
    {
      group: "Assessment",
      items: [
        "Multiple choice, fill-the-blank, short answer and matching",
        "Pass marks, attempt limits and time limits",
        "Question banks and randomised order",
        "Review of past attempts",
      ],
    },
    {
      group: "Certificates",
      items: [
        "A unique serial minted for every certificate",
        "Public check by serial, no account needed",
        "Certificate register with issue dates",
        "Revocations show on the public check at once",
      ],
    },
    {
      group: "Engagement & administration",
      items: [
        "Quarter badges and milestone badges",
        "Leaderboards scoped to your organisation",
        "Announcements and lesson Q&A",
        "Branding with a live contrast check",
        "Every change in the shared audit trail",
      ],
    },
  ],
  stats: [
    { label: "Lesson types", value: "4", note: "Video, article, document and quiz" },
    {
      label: "Mandatory training",
      value: "Due dates",
      note: "With an overdue report and CSV export",
    },
    { label: "Badges per course", value: "4", note: "One at each quarter" },
    {
      label: "Certificate check",
      value: "Public",
      note: "By serial, no account needed",
    },
  ],
  connections: [
    {
      to: "hrm",
      description:
        "Mandatory training sits beside the employee record, and compliance appears in the appraisal, so every review sees what was completed.",
    },
    {
      to: "admin",
      description:
        "A controlled policy document and the course that teaches it live in the same suite, so staff read and train in one place.",
    },
    {
      to: "projects",
      description:
        "Point a team at the path that closes a skill gap on a project, on the same sign-in they use for the work.",
    },
    {
      to: "finance",
      description:
        "Training spend lands on your company's own books and in the company finance report, like any other cost.",
    },
  ],
  faqs: [
    {
      question: "Is XwiftHQ LMS available now?",
      answer:
        "Yes. Courses, learning paths, mandatory training, the compliance report, quizzes and verifiable certificates all run on real data today.",
    },
    {
      question: "Who is XwiftHQ LMS built for?",
      answer:
        "Companies training their own staff: induction, policy and compliance courses, paths for each role, and certificates a client or auditor can check.",
    },
    {
      question: "Can someone outside the company check a certificate?",
      answer:
        "Yes. The check is public. It returns the holder, the course and the issue date, or says plainly that no such certificate exists or that it was revoked.",
    },
    {
      question: "How do we see who's overdue on compliance training?",
      answer:
        "The compliance report lists every mandatory course by person, with its due date and status, and exports to CSV for an audit.",
    },
    {
      question: "Are leaderboards visible to other organisations?",
      answer:
        "No. A leaderboard is scoped to your own organisation, and every record is isolated in the API regardless.",
    },
  ],
};

/* ------------------------------------------------------------------ */
/*  Registry                                                           */
/* ------------------------------------------------------------------ */

export const PRODUCTS: Record<ProductSlug, Product> = {
  finance: FINANCE,
  admin: ADMIN,
  hrm: HRM,
  projects: PROJECTS,
  lms: LMS,
};

/**
 * Company-first (owner, 9 October 2026): the suite leads with running the
 * business (money, then operations, then people, then delivery) and
 * learning follows as the training the workforce needs. Navigation, the
 * footer, the home page and the platform page all list the modules in this
 * order.
 */
export const PRODUCT_ORDER: readonly ProductSlug[] = [
  "finance",
  "admin",
  "hrm",
  "projects",
  "lms",
];

export const PRODUCT_LIST: readonly Product[] = PRODUCT_ORDER.map(
  (slug) => PRODUCTS[slug],
);

/**
 * The five cross-module flows. These are the suite argument made concrete: a
 * module that cannot name what it hands to the next one is just an app that
 * happens to share a login. Every step below is a handover that exists in the
 * running product.
 */
export const SUITE_FLOWS: readonly ProductFlow[] = [
  {
    title: "Request → payment",
    steps: [
      { module: "admin", action: "Purchase requisition raised" },
      { module: "admin", action: "Quotations, award and purchase order" },
      { module: "admin", action: "Goods received" },
      { module: "finance", action: "Invoice matched, voucher approved" },
      { module: "finance", action: "Paid on a bank file and posted" },
    ],
  },
  {
    title: "Payroll → ledger",
    steps: [
      { module: "hrm", action: "Payroll run approved" },
      { module: "finance", action: "Journal posted by cost centre" },
      { module: "finance", action: "Net pay scheduled to the bank" },
    ],
  },
  {
    title: "Work → cost",
    steps: [
      { module: "projects", action: "Hours logged against stories" },
      { module: "admin", action: "Trips and events charged to the project" },
      { module: "finance", action: "Spend committed against project funds" },
      { module: "projects", action: "Expected against actual, shown on the project" },
    ],
  },
  {
    title: "Hire → productive",
    steps: [
      { module: "hrm", action: "Offer accepted, onboarding starts" },
      { module: "admin", action: "Laptop and access handed over" },
      { module: "lms", action: "Mandatory training assigned" },
      { module: "projects", action: "Added to the project team" },
    ],
  },
  {
    title: "Exit → final pay",
    steps: [
      { module: "hrm", action: "Leaver recorded" },
      { module: "admin", action: "Assets cleared on exit clearance" },
      { module: "finance", action: "Advances retired" },
      { module: "hrm", action: "Final pay released" },
    ],
  },
];

export function getProduct(slug: ProductSlug): Product {
  return PRODUCTS[slug];
}

/* ------------------------------------------------------------------ */
/*  The shared spine                                                   */
/* ------------------------------------------------------------------ */

/**
 * What every module sits on. Used as the labelled bar under SpineDiagram and
 * as the argument on /platform: five products are a suite only because these
 * six things are singular.
 */
export const SPINE_FACILITIES: readonly { icon: LucideIcon; label: string }[] = [
  { icon: IdCard, label: "Identity" },
  { icon: FolderTree, label: "Org tree" },
  { icon: ShieldCheck, label: "Permissions" },
  { icon: ScrollText, label: "Audit log" },
  { icon: Bell, label: "Notifications" },
  { icon: Gauge, label: "Reporting" },
];
