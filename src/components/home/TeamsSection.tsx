import { Briefcase, Building2, GraduationCap, KanbanSquare, Settings2, Wallet, type LucideIcon } from "lucide-react";

import { SectionHeading } from "@/components/site/SectionHeading";

/**
 * Who works in XwiftHQ, by role. Never attributed quotes: every task listed
 * is a screen that exists in the product.
 */

const TEAMS: { role: string; module: string; icon: LucideIcon; tone: string; tasks: string[] }[] = [
  {
    role: "Finance teams",
    module: "Finance",
    icon: Wallet,
    tone: "bg-accent-500/15 text-accent-700",
    tasks: [
      "Check, approve and pay vouchers right through to the bank file",
      "Reconcile bank statements and close each period",
      "Release project funds and track budgets against actual",
    ],
  },
  {
    role: "Operations",
    module: "Admin and Operations",
    icon: Building2,
    tone: "bg-sky-100 text-sky-700",
    tasks: [
      "Take purchases from requisition to goods received",
      "Book trips, events and vehicles against their budgets",
      "Keep assets, stores and compliance dates on track",
    ],
  },
  {
    role: "HR managers",
    module: "People",
    icon: Briefcase,
    tone: "bg-violet-500/15 text-violet-700",
    tasks: [
      "Hire, onboard and offboard from a single employee record",
      "Handle leave, timesheets, payroll and appraisals",
      "Settle leavers as soon as their clearance is complete",
    ],
  },
  {
    role: "Delivery leads",
    module: "Projects",
    icon: KanbanSquare,
    tone: "bg-mint-100 text-mint-700",
    tasks: [
      "Plan sprints and stories on one board per project",
      "Run tests, log findings and follow the critical path",
      "Compare planned and actual spend on each project",
    ],
  },
  {
    role: "Training and compliance",
    module: "Learning",
    icon: GraduationCap,
    tone: "bg-primary-100 text-primary-700",
    tasks: [
      "Assign required courses with due dates",
      "Spot who is overdue and export it for an audit",
      "Issue certificates anyone can verify",
    ],
  },
  {
    role: "Company admins",
    module: "Every module",
    icon: Settings2,
    tone: "bg-neutral-200 text-neutral-800",
    tasks: [
      "Set up units, cost centres, roles and approval flows",
      "Add people and give them the roles you define",
      "Bring back anything deleted from the recycle bin",
    ],
  },
];

export function TeamsSection() {
  return (
    <section className="section-padding bg-neutral-50">
      <div className="section-container">
        <SectionHeading
          eyebrow="Built for every team"
          title="Every team gets its own space. Everyone shares the same truth."
          intro="Each role works in the module made for it, on the same people, records and approvals as everyone else."
        />

        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TEAMS.map((team) => (
            <li key={team.role} className="rounded-[1.25rem] border border-neutral-200/80 bg-white p-6 transition-shadow hover:shadow-[0_20px_40px_-24px_rgb(150_56_205/0.35)]">
              <div className="flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${team.tone}`} aria-hidden="true">
                  <team.icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="xw-h3 block text-base">{team.role}</span>
                  <span className="block text-xs text-neutral-500">{team.module}</span>
                </span>
              </div>
              <ul className="mt-5 space-y-2.5">
                {team.tasks.map((task) => (
                  <li key={task} className="flex gap-2.5 text-sm leading-relaxed text-neutral-600">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" aria-hidden="true" />
                    {task}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
