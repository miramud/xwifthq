import {
  Briefcase,
  Building2,
  GraduationCap,
  KanbanSquare,
  Settings2,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { SectionIntro } from "@/components/home/SectionIntro";

/**
 * Who the suite is for, in the template's card band.
 *
 * This band used to carry learner testimonials attributed to named people at
 * real companies. The site is now about the suite, and quotes nobody can
 * source are not something it will print, so the band describes the people who
 * run an organisation on Elevate and what each of them does in it — by role,
 * never by name or employer. Every task listed is a screen that exists.
 *
 * The row is a scroll container with snap points, as before: no state, no
 * handlers, navigable by touch, trackpad, scrollbar and Tab. It bleeds past the
 * container so a reader can see there is more to the right.
 */

interface Audience {
  role: string;
  modules: string;
  icon: LucideIcon;
  /** Tile fill. Gold carries Ink here, as it does everywhere else. */
  fill: string;
  tasks: string[];
}

const AUDIENCES: Audience[] = [
  {
    role: "Finance teams",
    modules: "Finance",
    icon: Wallet,
    fill: "bg-accent-500 text-neutral-900",
    tasks: [
      "Check, approve and pay vouchers through to the bank file",
      "Reconcile the bank and close each period",
      "Release project funds and watch budgets against actual",
    ],
  },
  {
    role: "Admin & operations",
    modules: "Admin & Operations",
    icon: Building2,
    fill: "bg-neutral-900 text-white",
    tasks: [
      "Run purchases from requisition to goods received",
      "Book trips, events and vehicles against their budgets",
      "Keep assets, stores and compliance dates in order",
    ],
  },
  {
    role: "HR managers",
    modules: "HR",
    icon: Briefcase,
    fill: "bg-violet-500 text-white",
    tasks: [
      "Hire, onboard and offboard from one employee record",
      "Run leave, timesheets, payroll and appraisals",
      "Settle leavers once their clearance is done",
    ],
  },
  {
    role: "Delivery leads",
    modules: "Projects",
    icon: KanbanSquare,
    fill: "bg-info-600 text-white",
    tasks: [
      "Plan sprints and stories on one board per project",
      "Test, track findings and see the critical path",
      "See expected against actual spend on the project",
    ],
  },
  {
    role: "Training & compliance",
    modules: "Learning",
    icon: GraduationCap,
    fill: "bg-primary-600 text-white",
    tasks: [
      "Assign mandatory courses with due dates",
      "See who is overdue and export it for an audit",
      "Issue certificates anyone can verify",
    ],
  },
  {
    role: "Organisation admins",
    modules: "Every module",
    icon: Settings2,
    fill: "bg-neutral-700 text-white",
    tasks: [
      "Set up units, cost centres, roles and approval workflows",
      "Add users and give them the roles you define",
      "Restore anything deleted from the recycle bin",
    ],
  },
];

export default function TestimonialsSection() {
  return (
    <section className="section-padding overflow-hidden bg-neutral-100">
      <div className="section-container">
        <SectionIntro
          eyebrow="Who it's for"
          title="The people who run a company, on one set of records."
          intro="Each role works in its own module and sees the same people, roles and records as everyone else."
        />
      </div>

      <ul className="mt-14 flex snap-x snap-mandatory gap-6 overflow-x-auto px-4 pb-4 sm:px-6 lg:px-8">
        {AUDIENCES.map((audience) => (
          <li
            key={audience.role}
            className="flex min-w-[18rem] max-w-md flex-1 snap-start flex-col rounded-2xl border border-neutral-200 bg-white p-7 sm:min-w-[22rem]"
          >
            <div className="flex items-center gap-4">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${audience.fill}`}
                aria-hidden="true"
              >
                <audience.icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block font-heading text-lg font-semibold text-neutral-900">
                  {audience.role}
                </span>
                <span className="label-mono mt-0.5 block text-neutral-500">
                  {audience.modules}
                </span>
              </span>
            </div>

            <ul className="mt-6 flex-1 space-y-3 border-t border-dashed border-neutral-300 pt-6">
              {audience.tasks.map((task) => (
                <li
                  key={task}
                  className="flex gap-3 text-base leading-relaxed text-neutral-700"
                >
                  <span
                    className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
                    aria-hidden="true"
                  />
                  {task}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
