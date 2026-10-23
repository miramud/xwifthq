import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Briefcase,
  GraduationCap,
  Inbox,
  KanbanSquare,
  LayoutGrid,
  Search,
  Settings2,
  Users,
} from "lucide-react";

import { XwiftLockup } from "@/components/shared/BrandLogo";
import { SectionHeading } from "@/components/site/SectionHeading";

/**
 * Getting started, in three steps, beside a drawn glimpse of the workspace
 * sidebar. The drawing is decorative; the steps carry the content.
 */

const NAV = [
  { icon: LayoutGrid, label: "Home", active: true },
  { icon: Inbox, label: "Approvals", badge: "4" },
  { icon: Banknote, label: "Finance" },
  { icon: Settings2, label: "Operations" },
  { icon: Users, label: "People" },
  { icon: KanbanSquare, label: "Projects" },
  { icon: GraduationCap, label: "Learning" },
  { icon: Briefcase, label: "Organisation" },
];

function WorkspaceGlimpse() {
  return (
    <div
      className="relative h-full min-h-[22rem] overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-primary-300 via-primary-500 to-primary-700 p-6 sm:p-8"
      aria-hidden="true"
    >
      <span className="xw-cloud -right-10 -top-6 h-32 w-72 opacity-40" />
      <div className="relative ml-auto mt-6 w-[92%] overflow-hidden rounded-xl bg-white shadow-2xl sm:mt-10">
        <div className="flex items-center gap-1.5 border-b border-neutral-100 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-coral-500" />
          <span className="h-2 w-2 rounded-full bg-sun-500" />
          <span className="h-2 w-2 rounded-full bg-mint-500" />
          <span className="ml-3 h-3 w-28 rounded-full bg-neutral-100" />
        </div>
        <div className="grid grid-cols-[9.5rem_1fr]">
          <div className="border-r border-neutral-100 p-3">
            <XwiftLockup markClassName="h-5 w-5" wordClassName="text-xs" />
            <p className="mt-4 text-[8px] font-semibold uppercase tracking-wider text-neutral-400">Workspace</p>
            <ul className="mt-2 space-y-0.5">
              {NAV.map(({ icon: Icon, label, active, badge }) => (
                <li
                  key={label}
                  className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[10px] ${
                    active ? "bg-primary-50 font-semibold text-primary-700" : "text-neutral-600"
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                  {badge && (
                    <span className="ml-auto rounded-full bg-primary-600 px-1.5 text-[8px] font-semibold text-white">{badge}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div className="p-3">
            <span className="flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-[9px] text-neutral-400">
              <Search className="h-2.5 w-2.5" /> Find anything
            </span>
            <p className="mt-3 font-heading text-sm font-bold text-neutral-900">Good morning, Ada</p>
            <p className="text-[9px] text-neutral-500">Four things need you today</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["Approvals", "4", "bg-primary-50 text-primary-700"],
                ["Leave today", "3", "bg-sky-50 text-sky-700"],
                ["Vouchers", "7", "bg-sun-50 text-sun-700"],
                ["Overdue training", "2", "bg-coral-50 text-coral-700"],
              ].map(([label, value, tone]) => (
                <div key={label} className={`rounded-lg p-2 ${tone}`}>
                  <p className="text-[8px] font-medium">{label}</p>
                  <p className="font-heading text-base font-bold">{value}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 space-y-1.5">
              {["Q4 travel advance", "Laptops for new hires", "Annual leave, 5 days"].map((t) => (
                <div key={t} className="flex items-center gap-2 rounded-md border border-neutral-100 px-2 py-1.5 text-[9px] text-neutral-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary-500" />
                  {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "Set up your company",
    body: "Add your company details, pick the modules you need and choose a plan. It takes minutes, not a project.",
  },
  {
    title: "Bring your team in",
    body: "Add your units, roles and approval levels, then invite people. Everyone signs in once and lands on their own work.",
  },
  {
    title: "Run everything from one place",
    body: "Requests, approvals, payroll, projects and training move through one workspace with a full audit trail.",
  },
];

export function ThreeSteps() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <SectionHeading
          title="Up and running in three steps"
          intro="A guided setup that gets your company live quickly, without a consultant."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-2">
          <WorkspaceGlimpse />

          <ol className="flex flex-col gap-5">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className={`flex flex-1 gap-5 p-6 ${i === 0 ? "xw-glow-card" : "rounded-[1.25rem] border border-neutral-200"}`}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-600 font-heading text-sm font-bold text-white">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="xw-h3 block">{step.title}</span>
                  <span className="mt-1.5 block text-sm leading-relaxed text-neutral-600">{step.body}</span>
                  {i === 0 && (
                    <Link
                      href="/get-started"
                      className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-700 hover:text-primary-800"
                    >
                      Start setup <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
