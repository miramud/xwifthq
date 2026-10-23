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
 * Elevate is five modules on one spine, and this file is the only place that
 * knows what the five are. Navigation, the footer, the platform page and all
 * five product pages derive from it — so a product's name, hue, route and
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
 * A product's hue is a label, not a theme — see the comment on HUE below.
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
  /** 4–7 concrete capabilities in that sub-area. */
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
  /** Exact product name, e.g. "Elevate HRM". */
  name: string;
  /** Name without the "Elevate " prefix, for tight spaces. */
  shortName: string;
  /** One line, sentence case, no full stop. Used under the name on cards. */
  tagline: string;
  /** 1–2 sentences. Card body and meta description seed. */
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
  /** 6–8 capability groups. This is the depth of the product page. */
  capabilities: ProductCapability[];
  /** 4 headline figures for the product page stat strip. */
  stats: { label: string; value: string; note?: string }[];
  /** How this product meets the other four. 3–4 entries. */
  connections: { to: ProductSlug; description: string }[];
  /** 4–5 entries. */
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
 * Projects recoloured its buttons sky, Elevate would stop reading as one
 * company — so every primary CTA on the site stays teal regardless of which
 * product's page it sits on. The hue is a *label*, not a theme.
 *
 * Note the asymmetry on `accent`, and do not "tidy" it away: every other hue
 * uses one value for `icon` and `text` because one value clears both bars.
 * Summit Gold does not. #E6A532 on white is 2.14:1 — unusable for anything.
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
    hex: "#0C4F54",
  },
  violet: {
    tile: "bg-violet-500/10",
    icon: "text-violet-600",
    text: "text-violet-700",
    rule: "bg-violet-500",
    border: "border-violet-500/25",
    hex: "#6B4E9E",
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
    hex: "#34464A",
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
  the running app — the copy was rewritten against what is built (Finance and
  Admin & Operations through Phase 4, HRM's thirteen tranches, Projects with
  testing and project financials, Learning as workforce training). If a line
  stops being true, cut it rather than soften it.
*/

const FINANCE: Product = {
  slug: "finance",
  name: "Elevate Finance",
  shortName: "Finance",
  tagline: "The ledger, spend control and reporting a company closes its books on",
  summary:
    "General ledger, banking and reconciliation, spend-to-pay with payment vouchers and withholding tax, revenue and receivables, budgets, project funds and fixed assets. Payroll, purchases and trips post to the same books, so month-end is a review, not a rebuild.",
  icon: Wallet,
  hue: "accent",
  href: "/products/finance",
  appHref: "/suite/finance",
  live: true,
  pillars: [
    {
      icon: Landmark,
      title: "A ledger that closes",
      description:
        "Start from a chart-of-accounts template, post journals, recur the ones that repeat and close each period with a lock. The trial balance, income statement, financial position and cash flow come straight off the posted entries.",
    },
    {
      icon: ClipboardCheck,
      title: "Spend that is checked before it is paid",
      description:
        "Payment and advance memos pass the finance control unit's checks, become payment vouchers with withholding tax worked out, and leave as a payment schedule and a bank file. Advances are retired against receipts, not forgotten.",
    },
    {
      icon: ArrowLeftRight,
      title: "Banking that reconciles itself",
      description:
        "Import a bank statement, let your own rules match the obvious lines, and review only what is left. Reconciliation reports show what was matched, by whom, and what is still open.",
    },
    {
      icon: PiggyBank,
      title: "Project funds under control",
      description:
        "Each project gets a budget by category and month, released in tranches. Commitments are counted when a purchase or trip is approved, so a project cannot spend money it was never released.",
    },
    {
      icon: Gauge,
      title: "Budgets with teeth",
      description:
        "Company budgets carry controls that warn or block a voucher that would overrun its line. The cash forecast reads the same commitments, so the money you expect to need is the money you planned.",
    },
    {
      icon: FileSpreadsheet,
      title: "One report for the whole company",
      description:
        "A printable company finance report — PDF on your letterhead with a QR check, and Excel — covers every analysis for a period, down to who raised each request.",
    },
  ],
  capabilities: [
    {
      group: "Ledger & close",
      items: [
        "Chart of accounts from a starter template, mapped to your cost centres",
        "Manual and recurring journals with approval",
        "Accounting periods, close and lock",
        "Trial balance, income statement, financial position and cash flow",
        "Payroll journals posted by cost centre from HRM",
        "Drill-down from a figure to the entries behind it",
      ],
    },
    {
      group: "Banking & reconciliation",
      items: [
        "Bank accounts with maker-checker changes to their details",
        "Statement import with review before anything posts",
        "Matching rules you write once and reuse",
        "Reconciliation reports per account and period",
        "Payment schedules and bank payment files",
      ],
    },
    {
      group: "Spend to pay",
      items: [
        "Payment memos and staff advance memos",
        "Finance control unit checks before a voucher is raised",
        "Payment vouchers with withholding tax computed",
        "Advance retirement against receipts",
        "Step-up sign-in check for high-value approvals",
        "Every step on the suite's approval engine",
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
        "Tranche releases and commitments from approved spend",
        "Labour costing from logged hours and payroll",
        "Expected against actual expense on every project",
        "Portfolio view with RAG status and earned value",
      ],
    },
    {
      group: "Budgets & cash",
      items: [
        "Company budgets by cost centre with approval",
        "Controls that warn or block an overrunning voucher",
        "Budget against actual by line",
        "Cash forecast from commitments and expected receipts",
      ],
    },
    {
      group: "Tax, assets & reporting",
      items: [
        "Withholding tax remittance and certificates",
        "Fixed asset books with monthly depreciation and disposal",
        "Assets booked when their payment voucher is approved",
        "Company finance report as branded PDF and Excel",
        "Every posting in the shared audit trail",
      ],
    },
  ],
  stats: [
    {
      label: "Financial statements",
      value: "4",
      note: "Trial balance, income statement, financial position, cash flow",
    },
    {
      label: "Spend to pay",
      value: "Memo → bank",
      note: "Control checks, voucher, WHT, schedule, bank file",
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
        "Purchases, trips and events approved in Admin & Operations arrive as commitments against the right budget, and an invoice is matched to its order and goods received before a voucher is raised.",
    },
    {
      to: "hrm",
      description:
        "A payroll run posts its journal by cost centre and its net pay leaves on a bank file. A leaver's final pay waits until Finance has no unretired advance against them.",
    },
    {
      to: "projects",
      description:
        "Each project's budget, releases and spend show on the project itself, beside labour cost from logged hours — expected against actual, without an export.",
    },
    {
      to: "lms",
      description:
        "Training spend sits on the same books as everything else, so the cost of a compliance programme is a line in the company report rather than a guess.",
    },
  ],
  faqs: [
    {
      question: "Is Elevate Finance available now?",
      answer:
        "Yes. The ledger, banking, spend-to-pay, revenue, budgets, project funds, fixed assets and the company report all run against real data today.",
    },
    {
      question: "Do we need a separate accounting system?",
      answer:
        "No. Finance is a full general ledger with periods, close and the four financial statements. Payroll, purchasing and travel post into it, so there is nothing to import at month-end.",
    },
    {
      question: "Who approves a payment?",
      answer:
        "Whoever your approval workflow says. Finance uses the suite's approval engine, so levels, amount bands and delegation are set once for your organisation, and high-value approvals ask for a second sign-in check.",
    },
    {
      question: "Can a closed period be changed?",
      answer:
        "Not silently. A closed period is locked; a correction is a dated journal in an open period, and both the close and the correction land in the audit trail.",
    },
    {
      question: "Can we see what each project has really spent?",
      answer:
        "Yes. Every project shows its approved budget against actual spend — labour from logged hours, travel, events and purchases — and the company report rolls them up.",
    },
  ],
};

const ADMIN: Product = {
  slug: "admin",
  name: "Elevate Admin",
  shortName: "Admin",
  tagline: "Admin & Operations: buying, travel, assets, stores, fleet and facilities",
  summary:
    "Procurement from requisition to goods received, the travel desk, events, the asset register, stores and stock, maintenance, facilities, fleet, the service desk, compliance and controlled documents — the day-to-day running of a company, on the same approvals and the same books.",
  icon: Building2,
  hue: "neutral",
  href: "/products/admin",
  appHref: "/suite/operations",
  live: true,
  pillars: [
    {
      icon: ShoppingBag,
      title: "Requisition to goods received",
      description:
        "A purchase request collects quotations, is awarded, becomes a purchase order and is received on a GRN or a service completion certificate. The invoice that follows is matched to all of it.",
    },
    {
      icon: Plane,
      title: "A travel desk with a policy",
      description:
        "Trips are priced against travel grades, advances are raised with the request, bookings and changes are recorded, and the trip report closes the loop. Events and workshops carry budgets of their own.",
    },
    {
      icon: Package,
      title: "Every asset has a holder",
      description:
        "Register, tag and hand over assets with a note the receiver acknowledges. Gate passes, verification counts and exit clearance mean a leaver's laptop is a line on a list, not a hunt.",
    },
    {
      icon: Wrench,
      title: "Stores, maintenance and fleet",
      description:
        "Stock ledgers, requisitions, counts approved by a second person and reorder alerts; maintenance plans and work orders; vehicles with their papers and bookings.",
    },
    {
      icon: ShieldCheck,
      title: "Compliance with a clock on it",
      description:
        "A compliance calendar for filings, licences and renewals, a bid pack you can download in one go, and controlled documents with versions, owners and disposal on approval.",
    },
    {
      icon: Inbox,
      title: "One front desk",
      description:
        "A service desk for internal requests, a correspondence register, visitor pre-registration and a document repository — the things every office runs, in the same place as everything else.",
    },
  ],
  capabilities: [
    {
      group: "Procurement",
      items: [
        "Purchase requisitions with optional attachments",
        "Quotations per vendor, comparison and award",
        "Purchase orders from the award",
        "Goods received notes and service completion certificates",
        "Invoice matched to order and receipt",
        "Vendors shared with Finance as counterparties",
      ],
    },
    {
      group: "Travel & events",
      items: [
        "Travel policy grades and allowances",
        "Trip requests with advances",
        "Bookings, changes and trip reports",
        "Travel calendar for the whole organisation",
        "Events, workshops and engagements with budgets",
        "Charged to a project or cost centre at request",
      ],
    },
    {
      group: "Assets",
      items: [
        "Asset register with categories and tags",
        "Handover notes acknowledged by the receiver",
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
        "Work orders with a warranty check on paid repairs",
        "Leases, utilities and service contracts",
        "Fleet register with vehicle papers and renewal dates",
        "Vehicle bookings and diesel log",
      ],
    },
    {
      group: "Service desk & front office",
      items: [
        "Service catalogue and tickets",
        "A reported fault becomes a work order",
        "Correspondence register, in and out",
        "Visitor pre-registration",
        "Client payment requests raised for Finance",
      ],
    },
    {
      group: "Compliance & documents",
      items: [
        "Compliance calendar with due and overdue obligations",
        "Bid pack downloaded as one file",
        "Document repository shared across the suite",
        "Controlled documents with versions and owners",
        "Disposal of a controlled document on approval",
        "Staff policies read and acknowledged from My space",
      ],
    },
  ],
  stats: [
    {
      label: "Procurement chain",
      value: "PR → GRN",
      note: "Quotations, award, order, receipt, matched invoice",
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
      note: "Filings, licences and vehicle papers with due dates",
    },
  ],
  connections: [
    {
      to: "finance",
      description:
        "An approved purchase, trip or event commits against its budget the moment it is approved, and the invoice reaches Finance already matched to its order and goods received.",
    },
    {
      to: "hrm",
      description:
        "New joiners receive their assets on a handover note; leavers clear them on exit clearance, and anything unreturned flows into HRM final pay as a deduction.",
    },
    {
      to: "projects",
      description:
        "Trips, events and purchases are charged to a project at request, so the project's Finance tab shows what was spent on it and by whom.",
    },
    {
      to: "lms",
      description:
        "Policies published as controlled documents can sit beside a mandatory course, so staff read the policy and complete the training in one place.",
    },
  ],
  faqs: [
    {
      question: "Is Elevate Admin & Operations available now?",
      answer:
        "Yes. Procurement, travel, events, assets, stores, maintenance, facilities, fleet, the service desk, compliance and documents all run against real data today.",
    },
    {
      question: "Is this the same as the organisation console?",
      answer:
        "No. The organisation console sets up the company — users, roles, structure, approval workflows, numbering and branding. Admin & Operations is where the day-to-day running happens: buying, travelling, holding assets and keeping the office compliant.",
    },
    {
      question: "How are purchases approved?",
      answer:
        "On the suite's approval engine. Your organisation defines the levels and amount bands once, approvers see every request in one inbox, and delegation covers anyone who is away.",
    },
    {
      question: "What happens to a leaver's assets?",
      answer:
        "They appear on the leaver's exit clearance. Anything not returned becomes a deduction in HRM final pay, and final pay stays blocked until the clearance is settled.",
    },
    {
      question: "Can we charge travel and events to a project?",
      answer:
        "Yes. Each request picks a project or cost centre, commits against its funds when approved, and shows up in that project's expected-against-actual figures.",
    },
  ],
};

const HRM: Product = {
  slug: "hrm",
  name: "Elevate HRM",
  shortName: "HRM",
  tagline: "Every employment event, from the offer to the final pay, on one record",
  summary:
    "Directory, onboarding, contracts, leave, attendance, rotas, timesheets, payroll with statutory deductions, recruitment, performance, employee relations and leavers — on one employee record, with self-service for every member of staff.",
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
        "A person is created once. Contracts, documents with expiry dates, leave balances, pay, appraisals, cases and training all hang off the same record, so the answer never depends on which screen you asked.",
    },
    {
      icon: UserPlus,
      title: "Requisition to first day",
      description:
        "Vacancies start as requisitions, candidates move through interviews to an offer, and an accepted offer becomes an onboarding journey with probation milestones and a contract.",
    },
    {
      icon: CalendarCheck,
      title: "Leave, rotas and time that agree",
      description:
        "Leave types with balances and carry-over, shift rotas with coverage, attendance and timesheets feed one another. Approved overtime reaches the payslip instead of a spreadsheet.",
    },
    {
      icon: Banknote,
      title: "Payroll with the statutory work built in",
      description:
        "Earnings and deduction elements, statutory deductions and payslips from one run, with the journal handed to Finance by cost centre and net pay paid on a bank file.",
    },
    {
      icon: Target,
      title: "Performance that is measured",
      description:
        "Goals, KPIs and milestones with real attainment, appraisal cycles, and compliance training shown alongside the review.",
    },
    {
      icon: LogOut,
      title: "Leavers, done properly",
      description:
        "Exit interview, clearance checklist and final settlement. Final pay is held while assets are unreturned or advances unretired, so nobody leaves owing the company something it forgot.",
    },
  ],
  capabilities: [
    {
      group: "People & records",
      items: [
        "Staff directory with org units and job titles",
        "Personal details, emergency contacts and documents with expiry",
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
        "Reschedule, abandon or archive a journey",
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
        "Statutory deductions applied per run",
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
        "Targets due, in one view",
        "Appraisal cycles",
        "Compliance training shown beside the review",
      ],
    },
    {
      group: "Employee relations & leavers",
      items: [
        "Disciplinary cases that follow the process stage by stage",
        "Grievances raised by staff themselves",
        "Warnings that expire on a date",
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
        "CSV export of every analysis",
      ],
    },
  ],
  stats: [
    {
      label: "Employment lifecycle",
      value: "Offer → final pay",
      note: "One record the whole way through",
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
        "A payroll run posts its journal by cost centre and is paid on a bank file. Unretired advances in Finance hold a leaver's final pay until they are cleared.",
    },
    {
      to: "admin",
      description:
        "Joiners receive assets on a handover note; leavers return them on exit clearance, and anything missing becomes a final-pay deduction without anyone re-keying it.",
    },
    {
      to: "projects",
      description:
        "Project teams are drawn from the same staff and job titles, so a person's role on a project and their record in HR are the same person.",
    },
    {
      to: "lms",
      description:
        "Mandatory training and its due dates sit beside the employee record, and compliance shows up in the appraisal without moving a rating on its own.",
    },
  ],
  faqs: [
    {
      question: "Is Elevate HRM available now?",
      answer:
        "Yes. Onboarding, contracts, probation, leave, attendance, rotas, timesheets, payroll, recruitment, performance, employee relations and leavers all run against real data today.",
    },
    {
      question: "How does payroll reach the accounts?",
      answer:
        "Each run produces payslips and a journal split by cost centre. Finance posts the journal to the general ledger and pays net pay on a bank file — there is no spreadsheet in between.",
    },
    {
      question: "Can managers approve leave without HR?",
      answer:
        "Yes. Supervisors see their own team, approve leave and timesheets, and the approval workflow decides who may approve what.",
    },
    {
      question: "What stops a leaver being paid while still holding a laptop?",
      answer:
        "Exit clearance. Unreturned assets from Admin & Operations and unretired advances from Finance both block final settlement until they are cleared or deducted.",
    },
    {
      question: "Is employee data isolated between organisations?",
      answer:
        "Yes. Every record is scoped to an organisation, and the boundary is enforced in the API rather than in the interface.",
    },
  ],
};

const PROJECTS: Product = {
  slug: "projects",
  name: "Elevate Projects",
  shortName: "Projects",
  tagline: "Plan, test and deliver projects — and know what they cost",
  summary:
    "Story boards, sprints, testing, schedules and the critical path, with team performance, rate cards and a Finance tab that sets expected expense against actual. Clients follow along on a share link; the team gets updates in Slack, WhatsApp or email.",
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
        "Cards are stories, grouped by epic, linked to the sprint that delivers them. Import a backlog, plan the sprint, and the board shows what is actually moving.",
    },
    {
      icon: Bot,
      title: "AI that plans with you",
      description:
        "The delivery planner drafts epics and stories from a brief, the assistant answers questions about the project, and test cases are drafted from each story for a person to accept.",
    },
    {
      icon: FlaskConical,
      title: "Testing built in",
      description:
        "QA sprints, a test-case library and runs per sprint. A failed test raises a finding with severity and steps to reproduce, and findings are bugs on the same board.",
    },
    {
      icon: TrendingUp,
      title: "Performance from real sprints",
      description:
        "Velocity, variability and a delivery forecast from what the team actually closed, with an Excel export that includes the money for people allowed to see it.",
    },
    {
      icon: Coins,
      title: "Expected against actual",
      description:
        "Rate cards turn logged hours into labour cost; travel, events and purchases charged to the project add the rest. The Finance tab sets all of it against the approved budget.",
    },
    {
      icon: Share2,
      title: "Clients and channels",
      description:
        "Share a read-only view with a client by link, and send assignments and updates to Slack, WhatsApp, Gmail or Zoho Mail.",
    },
  ],
  capabilities: [
    {
      group: "Board & backlog",
      items: [
        "Story board with epics and swimlanes",
        "Backlog import",
        "Story and sprint linking",
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
        "AI delivery planner from a brief",
      ],
    },
    {
      group: "Testing",
      items: [
        "QA and security analyst roles",
        "Test sprints that run beside delivery sprints",
        "Test-case library",
        "AI-drafted test cases per story",
        "Findings with severity, steps and a recommendation",
      ],
    },
    {
      group: "Performance",
      items: [
        "Velocity and variability from closed sprints",
        "Delivery forecast",
        "Per-person contribution",
        "Excel performance sheet",
      ],
    },
    {
      group: "Cost & finance",
      items: [
        "Rate cards per member",
        "Time logs costed at the rate",
        "Finance tab: budget, releases, commitments and spend",
        "Expected against actual expense",
        "Budget drafted by the project manager and approved in Finance",
      ],
    },
    {
      group: "People & sharing",
      items: [
        "Project roles from the organisation's job titles",
        "Client share links, read-only",
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
        "Notifications in the app",
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
      note: "QA sprints, case library, AI test cases",
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
        "The project's budget, tranche releases and commitments come from Finance and sit on the project's own Finance tab, against labour cost from logged hours.",
    },
    {
      to: "admin",
      description:
        "Trips, events and purchases are charged to the project when they are requested, so the project sees its real spend without waiting for month-end.",
    },
    {
      to: "hrm",
      description:
        "Teams are staffed from HRM's people and job titles, so project roles and employment records never disagree about who someone is.",
    },
    {
      to: "lms",
      description:
        "When a team needs a skill, the training that supplies it is in the same suite and on the same sign-in.",
    },
  ],
  faqs: [
    {
      question: "Is Elevate Projects available now?",
      answer:
        "Yes. Story boards, sprints, testing, schedules, performance, project finance, client share links and the Slack, WhatsApp and email integrations all run against real data today.",
    },
    {
      question: "Does every project need Finance?",
      answer:
        "No. Without Finance you still get labour cost from logged hours at your rate cards. With it, each project also shows its approved budget, releases and real spend.",
    },
    {
      question: "Who can see the money?",
      answer:
        "Only people with the cost permission. Everyone else sees delivery figures — velocity, forecasts and progress — without rates or spend.",
    },
    {
      question: "Can clients follow a project?",
      answer:
        "Yes, through a read-only share link scoped to that project. They see the progress you chose to share and nothing beside it.",
    },
    {
      question: "Does the AI decide anything on its own?",
      answer:
        "No. The planner and test-case drafts are proposals a person accepts or edits; nothing lands on the board without someone choosing it.",
    },
  ],
};

const LMS: Product = {
  slug: "lms",
  name: "Elevate LMS",
  shortName: "LMS",
  tagline: "Staff training and compliance, with certificates anyone can verify",
  summary:
    "Courses, learning paths and mandatory training with due dates for your staff, a compliance report that shows who is overdue, and certificates that anyone can check by serial. Branded as your company.",
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
        "Mark a course as mandatory, give it a due date and assign it to a person, a team or everyone. The compliance report shows who is done, who is due and who is overdue, and exports to CSV.",
    },
    {
      icon: Route,
      title: "Learning paths for each role",
      description:
        "Order courses into a path and assign it in one action. Progress is measured against the path, so each person knows the next step.",
    },
    {
      icon: MonitorPlay,
      title: "Video, article, document and quiz",
      description:
        "Build courses from any mix of lessons, with media from your own library. Quizzes carry pass marks, attempt and time limits, question banks and shuffling.",
    },
    {
      icon: BadgeCheck,
      title: "Certificates that verify",
      description:
        "Every certificate carries a serial. A client, an auditor or a regulator can check it without an account, and a revoked certificate says so.",
    },
    {
      icon: Trophy,
      title: "Progress people can see",
      description:
        "Badges at each quarter of a course and leaderboards scoped to your own organisation — motivating inside a team, never a public ranking.",
    },
    {
      icon: Palette,
      title: "Your company's look",
      description:
        "Logo and accent colour per organisation, with the contrast checked as the admin types, so training never ships in a colour nobody can read.",
    },
  ],
  capabilities: [
    {
      group: "Courses",
      items: [
        "Curriculum builder with sections and lessons",
        "Video, article, document and quiz lessons",
        "Media library on your own storage",
        "Draft, review and publish with an approval policy",
        "Course reviews moderated before they show",
      ],
    },
    {
      group: "Assignment & paths",
      items: [
        "Ordered learning paths",
        "Assign to one person, a team or everyone",
        "Withdraw an assignment and keep the progress",
        "Roster of who has started, stalled and finished",
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
        "A serial minted per certificate",
        "Public check by serial, no account needed",
        "Certificate register with issue dates",
        "Revocation the public check shows at once",
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
      note: "With an overdue report and CSV",
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
        "Mandatory training sits beside the employee record, and compliance appears in the appraisal so a review sees what was completed.",
    },
    {
      to: "admin",
      description:
        "A controlled policy document and the course that teaches it sit in the same suite, so staff read and train in one place.",
    },
    {
      to: "projects",
      description:
        "Teams can be pointed at the path that closes a skill gap on a project, on the same sign-in they use for the work.",
    },
    {
      to: "finance",
      description:
        "Training spend lands on the company's own books and in the company finance report, like any other cost.",
    },
  ],
  faqs: [
    {
      question: "Is Elevate LMS available now?",
      answer:
        "Yes. Courses, learning paths, mandatory training, the compliance report, quizzes and verifiable certificates all run against real data today.",
    },
    {
      question: "Who is Elevate LMS built for?",
      answer:
        "Companies training their own staff: induction, policy and compliance courses, paths for each role, and certificates that a client or an auditor can check.",
    },
    {
      question: "Can someone outside the company check a certificate?",
      answer:
        "Yes. The check is public and returns the holder, the course and the issue date, or says plainly that no such certificate exists or that it was revoked.",
    },
    {
      question: "How do we see who is overdue on compliance training?",
      answer:
        "The compliance report lists every mandatory course by person with its due date and status, and exports to CSV for an audit.",
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
 * business — money, then operations, then people, then delivery — and
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
      { module: "projects", action: "Expected against actual on the project" },
    ],
  },
  {
    title: "Hire → productive",
    steps: [
      { module: "hrm", action: "Offer accepted, onboarding begins" },
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
 * as the argument on /platform — five products are a suite only because these
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
