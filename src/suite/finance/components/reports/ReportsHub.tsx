"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, BookOpenCheck, Droplets, FileBarChart2, Receipt, Scale, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/workspace/kit";
import type { Hue } from "@/components/workspace/modules";
import { IconTile } from "@/suite/lms/components/ui/ws";

/** The financial statements, each one choice away. */

const REPORTS: { href: string; title: string; body: string; icon: LucideIcon; hue: Hue }[] = [
  {
    href: "/suite/finance/reports/income-statement",
    title: "Income statement",
    body: "Income, expenditure and the surplus or deficit, with the year month by month.",
    icon: Receipt,
    hue: "mint",
  },
  {
    href: "/suite/finance/reports/balance-sheet",
    title: "Financial position",
    body: "What the organisation owns and owes at a date, and its net assets.",
    icon: Scale,
    hue: "grape",
  },
  {
    href: "/suite/finance/reports/cash-flow",
    title: "Cash flow",
    body: "Cash in and out of the bank accounts by activity, from opening to closing cash.",
    icon: Droplets,
    hue: "sky",
  },
  {
    href: "/suite/finance/reports/trial-balance",
    title: "Trial balance",
    body: "Every account's debit or credit balance, and proof the two sides agree.",
    icon: BookOpenCheck,
    hue: "blue",
  },
  {
    href: "/suite/finance/accounts",
    title: "Account ledgers",
    body: "Open any account in the chart to see each posting and its running balance.",
    icon: BookOpen,
    hue: "coral",
  },
];

export default function ReportsHub() {
  return (
    <div>
      <PageHeader
        title="Financial statements"
        subtitle="Computed from posted journals. Each opens on the financial year to date and can be narrowed by dates, cost centre, project, client or vendor, or unit."
      />
      <Link
        href="/suite/finance/reports/company"
        className="ws-card group mb-6 flex flex-col gap-4 p-5 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300 sm:flex-row sm:items-center sm:p-6"
      >
        <IconTile icon={FileBarChart2} hue="blue" size={52} />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-primary-700">Whole organisation</span>
          <span className="mt-0.5 block text-lg font-bold tracking-tight text-neutral-900">Company report</span>
          <span className="mt-1 block max-w-3xl text-sm text-neutral-500">
            Every analysis for a period in one place: the statements, budget against actual, each project&apos;s expected against actual, spend, every request and the person who raised it, receivables, payables, tax, assets, labour and approvals. Print it, or download the PDF or Excel.
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary-700">
          Open report <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </Link>
      <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className="ws-card group flex h-full flex-col gap-4 p-5 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <IconTile icon={r.icon} hue={r.hue} size={44} />
              <span className="flex-1">
                <span className="block text-[15px] font-semibold text-neutral-900">{r.title}</span>
                <span className="mt-1 block text-sm text-neutral-500">{r.body}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-primary-700">
                Open <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
