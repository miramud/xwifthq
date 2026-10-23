import { Bell, ChevronDown, Filter, LayoutGrid, List, MessageSquare, Paperclip, Plus, Search } from "lucide-react";
import { XwiftLockup } from "@/components/shared/BrandLogo";

/**
 * A drawn preview of the workspace for the hero: the approvals board, where a
 * request from any module moves from submitted to paid. Built in HTML rather
 * than shown as a screenshot so it stays crisp, on brand and light. It is an
 * illustration, so the whole thing is one labelled image to assistive tech.
 */

type Tag = { label: string; tone: string };

const TAGS: Record<string, Tag> = {
  finance: { label: "Finance", tone: "bg-accent-500/15 text-accent-700" },
  ops: { label: "Operations", tone: "bg-sky-100 text-sky-700" },
  hr: { label: "People", tone: "bg-violet-500/15 text-violet-700" },
  projects: { label: "Projects", tone: "bg-mint-100 text-mint-700" },
  learning: { label: "Learning", tone: "bg-primary-100 text-primary-700" },
};

const PEOPLE = [
  "bg-coral-500",
  "bg-primary-500",
  "bg-sky-500",
  "bg-mint-500",
  "bg-sun-500",
];

function Avatars({ seed, count = 3 }: { seed: number; count?: number }) {
  return (
    <span className="flex -space-x-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={`h-4 w-4 rounded-full ring-2 ring-white ${PEOPLE[(seed + i) % PEOPLE.length]}`}
        />
      ))}
    </span>
  );
}

const COLUMNS: {
  title: string;
  dot: string;
  cards: { tag: keyof typeof TAGS; title: string; note: string; status: string; statusTone: string; comments: number; files: number }[];
}[] = [
  {
    title: "Submitted",
    dot: "bg-neutral-400",
    cards: [
      { tag: "ops", title: "Laptops for new hires", note: "Three units, quotes attached for review", status: "Low", statusTone: "bg-neutral-100 text-neutral-600", comments: 4, files: 3 },
      { tag: "learning", title: "Safety course renewal", note: "Due for the whole field team", status: "Due soon", statusTone: "bg-sun-100 text-sun-700", comments: 2, files: 1 },
    ],
  },
  {
    title: "In review",
    dot: "bg-sky-500",
    cards: [
      { tag: "finance", title: "Q4 travel advance", note: "Second approval needed above the limit", status: "High", statusTone: "bg-coral-100 text-coral-700", comments: 12, files: 2 },
      { tag: "hr", title: "Annual leave, 5 days", note: "Cover agreed with the line manager", status: "Today", statusTone: "bg-sky-100 text-sky-700", comments: 3, files: 0 },
    ],
  },
  {
    title: "Approved",
    dot: "bg-primary-500",
    cards: [
      { tag: "projects", title: "Sprint 14 contractor fee", note: "Charged to the client portal project", status: "Ready", statusTone: "bg-primary-100 text-primary-700", comments: 6, files: 4 },
      { tag: "ops", title: "Fleet service booking", note: "Two vehicles, Thursday morning", status: "Booked", statusTone: "bg-mint-100 text-mint-700", comments: 1, files: 1 },
    ],
  },
  {
    title: "Paid",
    dot: "bg-mint-500",
    cards: [
      { tag: "finance", title: "Office rent, October", note: "Posted to the ledger and reconciled", status: "Done", statusTone: "bg-mint-100 text-mint-700", comments: 2, files: 2 },
      { tag: "hr", title: "September payroll", note: "Net pay sent on the bank file", status: "Done", statusTone: "bg-mint-100 text-mint-700", comments: 8, files: 5 },
    ],
  },
];

export function AppPreview({ className = "" }: { className?: string }) {
  return (
    <div
      role="img"
      aria-label="The XwiftHQ approvals board: requests from finance, operations, people and projects moving from submitted to paid"
      className={`xw-frame overflow-hidden text-left ${className}`}
    >
      <div aria-hidden="true">
        {/* Top bar */}
        <div className="flex items-center gap-6 border-b border-neutral-100 px-5 py-3.5">
          <XwiftLockup markClassName="h-6 w-6" wordClassName="text-[15px]" />
          <nav className="hidden items-center gap-5 text-[11px] font-medium text-neutral-500 md:flex">
            <span className="rounded-full bg-primary-50 px-2.5 py-1 text-primary-700">Approvals</span>
            <span>Finance</span>
            <span>Operations</span>
            <span>People</span>
            <span>Projects</span>
            <span>Learning</span>
          </nav>
          <span className="ml-auto flex items-center gap-3 text-neutral-400">
            <Search className="h-3.5 w-3.5" />
            <span className="relative">
              <Bell className="h-3.5 w-3.5" />
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-coral-500 ring-2 ring-white" />
            </span>
            <span className="h-6 w-6 rounded-full bg-gradient-to-br from-primary-300 to-primary-600" />
          </span>
        </div>

        {/* Board header */}
        <div className="flex flex-wrap items-center gap-3 px-5 pt-4">
          <p className="font-heading text-[15px] font-bold text-neutral-900">Approvals board</p>
          <div className="ml-auto hidden items-center gap-4 text-[11px] text-neutral-500 sm:flex">
            <span className="font-semibold text-primary-700 underline decoration-2 underline-offset-[10px]">Board</span>
            <span>Calendar</span>
            <span>Reports</span>
            <span>Audit trail</span>
          </div>
          <span className="flex items-center">
            <Avatars seed={0} count={4} />
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary-600 text-[9px] font-semibold text-white">+8</span>
          </span>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-5 py-3 text-[10px] text-neutral-600">
          <span className="flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-1 font-medium text-neutral-900">
            <LayoutGrid className="h-3 w-3" /> Board view
          </span>
          <span className="flex items-center gap-1 px-2 py-1">
            <List className="h-3 w-3" /> List view
          </span>
          <span className="ml-auto hidden items-center gap-1 rounded-md border border-neutral-200 px-2 py-1 sm:flex">
            <Search className="h-3 w-3 text-neutral-400" /> Search requests
          </span>
          <span className="flex items-center gap-1 rounded-md border border-neutral-200 px-2 py-1">
            <Filter className="h-3 w-3" /> All modules <ChevronDown className="h-3 w-3" />
          </span>
        </div>

        {/* Columns */}
        <div className="grid grid-cols-2 gap-3 px-5 pb-5 lg:grid-cols-4">
          {COLUMNS.map((col, ci) => (
            <div key={col.title} className={`rounded-xl bg-neutral-100/80 p-2 ${ci > 1 ? "hidden lg:block" : ""}`}>
              <div className="flex items-center gap-1.5 px-1 pb-2 text-[11px] font-semibold text-neutral-800">
                <span className={`h-1.5 w-1.5 rounded-full ${col.dot}`} />
                {col.title}
                <span className="font-normal text-neutral-400">{col.cards.length}</span>
                <Plus className="ml-auto h-3 w-3 text-neutral-400" />
              </div>
              <div className="space-y-2">
                {col.cards.map((card, i) => {
                  const tag = TAGS[card.tag];
                  return (
                    <div key={card.title} className="rounded-lg border border-neutral-200/70 bg-white p-2.5 shadow-[0_1px_2px_rgb(16_18_31/0.04)]">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold ${tag.tone}`}>{tag.label}</span>
                      <p className="mt-1.5 text-[11px] font-semibold leading-snug text-neutral-900">{card.title}</p>
                      <p className="mt-0.5 line-clamp-1 text-[9.5px] text-neutral-500">{card.note}</p>
                      <span className={`mt-1.5 inline-block rounded px-1.5 py-0.5 text-[9px] font-medium ${card.statusTone}`}>{card.status}</span>
                      <div className="mt-2 flex items-center gap-2 border-t border-neutral-100 pt-2 text-[9px] text-neutral-400">
                        <Avatars seed={ci + i} />
                        <span className="ml-auto flex items-center gap-0.5">
                          <MessageSquare className="h-2.5 w-2.5" /> {card.comments}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Paperclip className="h-2.5 w-2.5" /> {card.files}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
