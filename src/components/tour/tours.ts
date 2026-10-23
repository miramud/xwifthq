/**
 * Every dashboard's walkthrough: which page it belongs to and what it points
 * at, step by step.
 *
 * A step's `target` names a `data-tour` anchor (`"stats"`, `"panel-alerts"`,
 * `"nav:/suite/org/users"`) or, when it starts with `[`, `#` or `.`, a CSS
 * selector. A list means "the first of these that is on screen" — the sidebar
 * on a desktop, the menu button on a phone. A step with no target is a centred
 * note, for a welcome or a closing line.
 *
 * Steps whose target isn't rendered are left out when the tour starts: a panel
 * hidden by permission, a section for a module the organisation hasn't switched
 * on. Nothing here has to know who is signed in.
 *
 * Most anchors come for free: the workspace shell marks its sidebar, menus and
 * top bar, `PageHeader` marks `page-header` and `page-actions`, `StatGrid`
 * marks `stats`, `SearchField` `search`, `Segmented` `segmented`, `DataView`
 * `data-view`, and every titled `Panel` marks `panel-<its title>`.
 */

export type TourKey =
  | "suite-home"
  | "org-overview"
  | "org-users"
  | "org-billing"
  | "platform-overview"
  | "lms-console"
  | "teach-studio"
  | "hrm"
  | "projects"
  | "my-learning"
  | "my-employment";

export type TourPlacement = "auto" | "top" | "bottom" | "left" | "right";

export interface TourStep {
  target?: string | string[];
  title: string;
  body: string;
  placement?: TourPlacement;
}

export interface TourDefinition {
  key: TourKey;
  /** A short name for the replay button and the dialog's label. */
  name: string;
  match: (pathname: string) => boolean;
  steps: TourStep[];
}

const exactly =
  (...paths: string[]) =>
  (pathname: string): boolean =>
    paths.includes(pathname.replace(/\/+$/, "") || "/");

/** The shell's menu: the sidebar on a desktop, the menu button on a phone. */
const MENU = ["sidebar", "menu-button"];

export const TOURS: TourDefinition[] = [
  {
    key: "suite-home",
    name: "Suite home",
    match: exactly("/suite"),
    steps: [
      {
        title: "Welcome to your suite",
        body: "Every module your organisation uses lives here, behind one sign-in. This takes about a minute — skip it any time, and replay it later from the ? button.",
      },
      {
        target: "[aria-label='Your suite']",
        title: "Start here",
        body: "A summary of what is switched on for you, with a way into each module.",
      },
      {
        target: "stats",
        title: "Figures from what you run",
        body: "Headline figures from the modules you look after — learners, completion, courses and ratings — without opening them.",
      },
      {
        target: "[aria-labelledby='suite-modules']",
        title: "Every module you can open",
        body: "Open a module from its card. Modules your organisation hasn't switched on are marked Preview, so you can see what they do.",
      },
      {
        target: MENU,
        title: "The same menu on every page",
        body: "Each module keeps its pages in this menu, in the same place wherever you are.",
      },
      {
        target: "suite-switcher",
        title: "Switch modules from anywhere",
        body: "Jump straight to another module, or to a page inside it, without coming back here.",
      },
      {
        target: "profile-menu",
        title: "Your account",
        body: "Your details, notification settings and sign-out — and Take the tour, to see this again.",
      },
    ],
  },
  {
    key: "org-overview",
    name: "Organisation overview",
    match: exactly("/suite/org"),
    steps: [
      {
        target: "page-header",
        title: "Your organisation at a glance",
        body: "One page that reports across every module you have switched on.",
      },
      {
        target: "segmented",
        title: "Choose the period",
        body: "Switch between the last 30 and 90 days. Every figure and chart on the page follows.",
      },
      {
        target: "[aria-labelledby='org-modules']",
        title: "Which modules are on",
        body: "Active modules report below. The others are previews of what you would get.",
      },
      {
        target: "[aria-labelledby='org-people']",
        title: "Your people",
        body: "Everyone who can sign in, who has been active lately, and who hasn't accepted their invitation yet.",
      },
      {
        target: "panel-needs-attention",
        title: "What needs you",
        body: "Anything waiting on a decision from you, the most serious first.",
      },
      {
        target: ["[aria-labelledby='org-lms']", "[aria-labelledby='org-hrm']", "[aria-labelledby='org-projects']"],
        title: "A section for each module",
        body: "Learning, HR and Projects each report their key figures, a trend and what to look at.",
      },
      {
        target: "nav:/suite/org/users",
        title: "Add and manage users",
        body: "Invite people, give them roles and see how each of them is getting on.",
      },
      {
        target: "nav:/suite/org/billing",
        title: "Plan & billing",
        body: "Buy more modules and find every receipt.",
      },
    ],
  },
  {
    key: "org-users",
    name: "User management",
    match: exactly("/suite/org/users"),
    steps: [
      {
        target: "page-header",
        title: "Everyone who can sign in",
        body: "Each person's role, what they do here and how their learning is going.",
      },
      {
        target: "page-actions",
        title: "Add someone",
        body: "They get an email with a temporary password and a link to sign in. They choose their own password the first time.",
      },
      {
        target: "stats",
        title: "Your people in numbers",
        body: "Everyone who can sign in, who has been active in the last 30 days, who is new this month, and who hasn't accepted their invitation yet.",
      },
      {
        target: "panel-role-mix",
        title: "Role mix",
        body: "Pick a role here to see only the people who hold it.",
      },
      {
        target: "data-view",
        title: "The list",
        body: "Search by name or email, or filter by role and status. Open anyone to see their learning, roles and activity; the ⋯ menu edits, resends an invitation or deletes — deleted users go to the recycle bin.",
      },
      {
        target: "nav:/suite/org/roles",
        title: "Roles & permissions",
        body: "Make your own roles from the list of permissions, then give them to people here.",
      },
    ],
  },
  {
    key: "org-billing",
    name: "Plan & billing",
    match: exactly("/suite/org/billing"),
    steps: [
      {
        target: "page-header",
        title: "Your plan and payments",
        body: "Modules are bought once and are yours to keep — there is nothing to renew.",
      },
      {
        target: ["billing-modules", "main"],
        title: "Choose modules",
        body: "Pick the modules you want. The price depends on how many you own in total, and when you add one you only pay the difference.",
      },
      {
        target: "billing-history",
        title: "Payments and receipts",
        body: "Every payment you have made, with a receipt you can print.",
      },
      {
        target: "nav:/suite/org/seats",
        title: "Seats",
        body: "How many people your organisation can have signed in.",
      },
      {
        target: "tour-help",
        title: "Help when you need it",
        body: "Replay the tour for the page you are on from this button.",
      },
    ],
  },
  {
    key: "platform-overview",
    name: "Platform overview",
    match: exactly("/suite/platform"),
    steps: [
      {
        target: "page-header",
        title: "The whole platform at a glance",
        body: "Every organisation, module and payment, in one place.",
      },
      {
        target: "stats",
        title: "Headline figures",
        body: "Revenue this month, organisations, active users, seats in use, and alerts that need you.",
      },
      {
        target: "panel-alerts",
        title: "Alerts",
        body: "Failed payments, gateway problems and stuck jobs, the most serious first. Each one links to where you fix it.",
      },
      {
        target: "panel-revenue",
        title: "Revenue",
        body: "What came in, month by month.",
      },
      {
        target: "panel-module-adoption",
        title: "Module adoption",
        body: "How many organisations use each module.",
      },
      {
        target: "panel-newest-organisations",
        title: "Newest organisations",
        body: "Who joined most recently.",
      },
      {
        target: "nav:/suite/platform/organisations",
        title: "Organisations",
        body: "Switch modules on or off for an organisation, and suspend or restore it.",
      },
      {
        target: "nav:/suite/platform/payments",
        title: "Payments",
        body: "Match every payment against the gateway, and settle the ones that don't add up.",
      },
    ],
  },
  {
    key: "lms-console",
    name: "Learning console",
    match: exactly("/suite/lms"),
    steps: [
      {
        target: "page-header",
        title: "Your learning programme today",
        body: "What is happening across your courses and learners.",
      },
      {
        target: "stats",
        title: "Catalogue and learners",
        body: "Learners, courses completed, published courses and the average rating.",
      },
      {
        target: "panel-performance",
        title: "Over time",
        body: "Enrolments and completions for the period you choose.",
      },
      {
        target: "panel-assigned-vs-chosen",
        title: "Assigned or chosen",
        body: "How people finish courses you assign, compared with the ones they chose themselves.",
      },
      {
        target: "[aria-labelledby='top-courses']",
        title: "Top courses",
        body: "Your busiest courses and how far people get in them.",
      },
      {
        target: "nav:/suite/lms/courses",
        title: "Courses",
        body: "Create courses, approve what instructors submit, and assign them to people.",
      },
      {
        target: "nav:/suite/lms/compliance",
        title: "Compliance",
        body: "Required training that is due or overdue, person by person.",
      },
    ],
  },
  {
    key: "teach-studio",
    name: "Teaching studio",
    match: exactly("/suite/lms/teach"),
    steps: [
      {
        target: "page-header",
        title: "Your teaching studio",
        body: "How your courses are doing this month.",
      },
      {
        target: "stats",
        title: "Your courses in numbers",
        body: "Your learners, courses completed, published courses and your average rating.",
      },
      {
        target: "panel-performance",
        title: "Over time",
        body: "Enrolments and completions on your courses.",
      },
      {
        target: "panel-to-do",
        title: "To-do",
        body: "What to do next to keep your courses healthy.",
      },
      {
        target: "panel-learner-progress",
        title: "How far learners get",
        body: "The average share of your courses people finish.",
      },
      {
        target: "nav:/suite/lms/teach/courses",
        title: "My courses",
        body: "Build a course and submit it for review when it is ready.",
      },
      {
        target: "nav:/suite/lms/teach/messages",
        title: "Q&A",
        body: "Learners' questions come here.",
      },
    ],
  },
  {
    key: "hrm",
    name: "HR overview",
    match: exactly("/suite/hrm"),
    steps: [
      {
        target: "page-header",
        title: "Your people today",
        body: "Who is here, what is waiting on a decision, and which dates are about to fall due.",
      },
      {
        target: "stats",
        title: "Your people in numbers",
        body: "Headcount, who is onboarding or on probation, and your interns.",
      },
      {
        target: "panel-where-people-are",
        title: "Where people are",
        body: "Everybody currently employed, by department.",
      },
      {
        target: "panel-today",
        title: "Today",
        body: "Who is in, who is on leave, and what the week is asking for.",
      },
      {
        target: "panel-needs-attention-now",
        title: "Past its date",
        body: "Anything already past its date.",
      },
      {
        target: "panel-waiting-on-somebody",
        title: "Waiting on someone",
        body: "Leave requests, shift swaps and timesheets nobody has decided yet.",
      },
      {
        target: "nav:/suite/hrm/people",
        title: "Directory",
        body: "Everyone's employment record, and where you take someone on.",
      },
      {
        target: "nav:/suite/hrm/me",
        title: "Your own record",
        body: "Your employment, leave, timesheet and pay.",
      },
    ],
  },
  {
    key: "projects",
    name: "Projects",
    match: exactly("/suite/projects"),
    steps: [
      {
        target: "page-header",
        title: "Your projects",
        body: "Every project you are on: what is moving, what is late, and what is due next.",
      },
      {
        target: "page-actions",
        title: "Start a project",
        body: "Set it up, add the team and open its board.",
      },
      {
        target: "stats",
        title: "Where things stand",
        body: "Open projects, those past their target, what is due in the next 30 days, and your clients.",
      },
      {
        target: "panel-target-dates-ahead",
        title: "Target dates ahead",
        body: "Projects due in each of the next six months.",
      },
      {
        target: "panel-needs-attention",
        title: "Needs attention",
        body: "Projects past their target date or on hold.",
      },
      {
        target: "nav:/suite/projects/me",
        title: "My work",
        body: "Everything assigned to you, across every project.",
      },
      {
        target: "nav:/suite/projects/portfolios",
        title: "Portfolios",
        body: "Group projects so you can report on them together.",
      },
    ],
  },
  {
    key: "my-learning",
    name: "My learning",
    match: exactly("/my-courses"),
    steps: [
      {
        target: "page-header",
        title: "Your learning",
        body: "Every course you are on, whether it was assigned to you or you chose it.",
      },
      {
        target: "stats",
        title: "Your progress in numbers",
        body: "How many courses you are on, how many are in progress or finished, and your average completion.",
      },
      {
        target: "learning-activity",
        title: "Your activity",
        body: "Lessons you have finished over time.",
      },
      {
        target: "course-filters",
        title: "Filter your courses",
        body: "Show everything, only required courses, or what is in progress or finished.",
      },
      {
        target: "course-grid",
        title: "Pick up where you left off",
        body: "Open a course to carry on from your last lesson.",
      },
      {
        target: "page-actions",
        title: "Achievements and more",
        body: "Your badges and certificates, and more courses to choose from.",
      },
    ],
  },
  {
    key: "my-employment",
    name: "My employment",
    match: exactly("/suite/hrm/me"),
    steps: [
      {
        target: "page-header",
        title: "Your record here",
        body: "Your job, your agreement and everything that is yours to see and do.",
      },
      {
        target: "stats",
        title: "At a glance",
        body: "How long you have been here, your first day, your employee number and your onboarding progress.",
      },
      {
        target: "panel-your-onboarding",
        title: "Your onboarding",
        body: "How far through your first steps you are.",
      },
      {
        target: "[aria-labelledby='checklist-heading']",
        title: "Your checklist",
        body: "What is still to do, and by when.",
      },
      {
        target: "panel-your-agreement",
        title: "Your agreement",
        body: "Your contract and its key terms.",
      },
      {
        target: "panel-your-team",
        title: "Your team",
        body: "The people you work with.",
      },
      {
        target: "panel-your-self-service",
        title: "Everything that is yours",
        body: "Leave, timesheets, pay and your details, one click away.",
      },
    ],
  },
];

export function tourForPath(pathname: string | null | undefined): TourDefinition | undefined {
  if (!pathname) return undefined;
  return TOURS.find((t) => t.match(pathname));
}

export function tourByKey(key: string): TourDefinition | undefined {
  return TOURS.find((t) => t.key === key);
}
