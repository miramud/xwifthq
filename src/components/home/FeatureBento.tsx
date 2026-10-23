import { Check, Eye, MoreHorizontal, Plus } from "lucide-react";

import { SectionHeading } from "@/components/site/SectionHeading";

/**
 * Four pale tiles, each a headline with a small drawn piece of the product
 * underneath. The drawings are illustrations (aria-hidden); the headline and
 * line under it carry the meaning.
 */

function Tile({
  title,
  body,
  children,
  className = "",
}: {
  title: string;
  body: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <article className={`xw-tile flex flex-col overflow-hidden p-6 sm:p-7 ${className}`}>
      <h3 className="xw-h3">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-600">{body}</p>
      <div className="mt-6 flex flex-1 items-end" aria-hidden="true">
        {children}
      </div>
    </article>
  );
}

const SPEND = [
  { label: "Awaiting checks", count: "18 requests", dot: "bg-neutral-400" },
  { label: "In approval", count: "11 requests", dot: "bg-primary-500" },
  { label: "Ready to pay", count: "7 vouchers", dot: "bg-sun-500" },
  { label: "Paid this month", count: "64 vouchers", dot: "bg-mint-500" },
];

const TEAM = [
  { initials: "AO", name: "Adaeze Okonkwo", status: "In today", tone: "bg-coral-500", badge: true },
  { initials: "TB", name: "Tunde Bello", status: "On leave until Friday", tone: "bg-sky-500" },
  { initials: "MI", name: "Maryam Ibrahim", status: "Onboarding, day 3", tone: "bg-mint-500", badge: true },
  { initials: "CE", name: "Chidi Eze", status: "In today", tone: "bg-sun-500" },
  { initials: "FA", name: "Funmi Adeyemi", status: "Probation review due", tone: "bg-violet-500" },
];

const PROJECTS = [
  { name: "Client portal rebuild", spend: "62%", team: ["bg-coral-500", "bg-primary-500", "bg-sky-500"] },
  { name: "Field survey, phase 2", spend: "38%", team: ["bg-mint-500", "bg-sun-500"] },
  { name: "Payroll migration", spend: "91%", team: ["bg-violet-500", "bg-primary-400", "bg-coral-500"] },
];

export function FeatureBento() {
  return (
    <section className="section-padding bg-white">
      <div className="section-container">
        <SectionHeading
          eyebrow="Why XwiftHQ"
          title={
            <>
              Everything your company runs on.
              <br className="hidden sm:block" /> Finally in one workspace.
            </>
          }
          intro="Stop stitching five tools together. Every module reads from the same people, the same approvals and the same books."
        />

        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          <Tile
            title="Spend you can see coming"
            body="Requests, checks, vouchers and payments in one pipeline, so nothing leaves the bank unapproved."
          >
            <div className="w-full rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgb(16_18_31/0.05)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] text-neutral-500">This month</p>
                  <p className="font-heading text-sm font-bold text-neutral-900">100 requests</p>
                </div>
                <span className="flex items-center gap-1 rounded-full border border-neutral-200 px-2 py-1 text-[10px] text-neutral-600">
                  <Eye className="h-3 w-3" /> View all
                </span>
              </div>
              <ul className="mt-3 space-y-2">
                {SPEND.map((row) => (
                  <li key={row.label} className="flex items-center gap-2 text-[11px] text-neutral-700">
                    <span className={`h-2 w-2 rounded-full ${row.dot}`} />
                    {row.label}
                    <span className="ml-auto text-neutral-500">{row.count}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex h-2 gap-1">
                <span className="w-[18%] rounded-full bg-neutral-300" />
                <span className="w-[11%] rounded-full bg-primary-500" />
                <span className="w-[7%] rounded-full bg-sun-500" />
                <span className="flex-1 rounded-full bg-mint-500" />
              </div>
            </div>
          </Tile>

          <Tile
            title="Approvals that route themselves"
            body="Set your levels and amount bands once. Every request finds the right approver, with cover when someone is away."
          >
            <div className="w-full rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgb(16_18_31/0.05)]">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-900">
                Your inbox
                <span className="text-[10px] font-medium text-neutral-500">4 waiting</span>
              </div>
              <div className="mt-3 rounded-xl border border-neutral-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700">Operations</span>
                  <MoreHorizontal className="h-3.5 w-3.5 text-neutral-400" />
                </div>
                <p className="mt-2 text-xs font-semibold text-neutral-900">Generator service contract</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="rounded bg-coral-100 px-1.5 py-0.5 text-[9px] font-medium text-coral-700">Level 2 of 3</span>
                  <span className="text-[10px] text-neutral-500">Raised by Chidi E.</span>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-primary-50 py-2 text-[11px] font-semibold text-primary-700">
                <Check className="h-3.5 w-3.5" /> Approve with second factor
              </div>
            </div>
          </Tile>

          <Tile
            className="lg:row-span-2"
            title="Your people, always current"
            body="One employee record from offer letter to final pay. Leave, onboarding and reviews update everywhere at once."
          >
            <div className="w-full rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgb(16_18_31/0.05)] lg:mb-6">
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-2 text-xs font-semibold text-neutral-900">
                  Who is in today
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[9px] text-white">5</span>
                </p>
                <MoreHorizontal className="h-3.5 w-3.5 text-neutral-400" />
              </div>
              <ul className="mt-3 divide-y divide-neutral-100">
                {TEAM.map((p) => (
                  <li key={p.name} className="flex items-center gap-3 py-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${p.tone}`}>
                      {p.initials}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold text-neutral-900">{p.name}</span>
                      <span className="block truncate text-[10px] text-neutral-500">{p.status}</span>
                    </span>
                    {p.badge && <span className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary-500" />}
                  </li>
                ))}
              </ul>
            </div>
          </Tile>

          <Tile
            className="lg:col-span-2"
            title="Projects that know what they cost"
            body="Boards, sprints and testing sit next to the money. Hours, trips and purchases land on the project as they happen."
          >
            <div className="w-full rounded-2xl bg-white p-4 shadow-[0_1px_2px_rgb(16_18_31/0.05)] sm:ml-auto sm:max-w-md">
              <div className="flex items-center justify-between text-xs font-semibold text-neutral-900">
                Project overview
                <Plus className="h-3.5 w-3.5 text-neutral-400" />
              </div>
              <div className="mt-3 grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-2.5 text-[11px]">
                <span className="text-[10px] text-neutral-500">Project</span>
                <span className="text-[10px] text-neutral-500">Budget used</span>
                <span className="text-[10px] text-neutral-500">Team</span>
                {PROJECTS.map((p) => (
                  <div key={p.name} className="contents">
                    <span className="truncate font-medium text-neutral-800">{p.name}</span>
                    <span className="flex items-center gap-2">
                      <span className="relative h-1.5 w-16 overflow-hidden rounded-full bg-neutral-100">
                        <span className="absolute inset-y-0 left-0 rounded-full bg-primary-500" style={{ width: p.spend }} />
                      </span>
                      <span className="tnum text-neutral-600">{p.spend}</span>
                    </span>
                    <span className="flex -space-x-1.5">
                      {p.team.map((t, i) => (
                        <span key={i} className={`h-5 w-5 rounded-full ring-2 ring-white ${t}`} />
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}
