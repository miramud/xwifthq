import {
  Bot,
  Bug,
  Check,
  FileSpreadsheet,
  FlaskConical,
  ShieldAlert,
} from "lucide-react";
import { MockFrame } from "@/components/platform/MockFrame";

/**
 * Drawn figures for the Projects deep dive.
 *
 * The real screens are in the tour higher up the page; these drawings isolate
 * one mechanism each so it can be read in a glance. Every name and number is
 * illustrative and labelled so. Brand purple carries the data marks and the
 * pills; the module's sky hue is the dot in the frame's address bar. Gold
 * appears only where something is over budget or failed, always with a word
 * beside it so colour never carries the meaning alone.
 */

function IllustrativePill() {
  return (
    <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[10px] font-medium text-neutral-500">
      Illustrative
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  1. Expected expense against actual                                */
/* ------------------------------------------------------------------ */

const SPEND: { source: string; who: string; amount: number }[] = [
  { source: "Labour: logged hours × rate card", who: "Delivery team", amount: 6_840_000 },
  { source: "Travel: site visit, Abuja", who: "Raised by T. Bello", amount: 1_120_000 },
  { source: "Event: client workshop", who: "Raised by C. Eze", amount: 860_000 },
  { source: "Purchase: test devices", who: "Raised by A. Okafor", amount: 540_000 },
  { source: "Memo: staff advance", who: "Raised by N. Musa", amount: 210_000 },
];

const EXPECTED = 9_000_000;

function naira(value: number) {
  return `₦${value.toLocaleString("en-GB")}`;
}

export function ExpectedActualFigure() {
  const actual = SPEND.reduce((total, row) => total + row.amount, 0);
  const pct = Math.round((actual / EXPECTED) * 100);
  const over = actual > EXPECTED;

  return (
    <MockFrame label="projects / hr-system / finance" hue="info">
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Expected against actual
        </p>
        <IllustrativePill />
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
        <div className="rounded-xl bg-neutral-100 px-3.5 py-3">
          <dt className="text-[11px] font-medium text-neutral-500">Expected (approved budget)</dt>
          <dd className="tnum mt-1 font-heading text-base font-bold text-neutral-900">
            {naira(EXPECTED)}
          </dd>
        </div>
        <div className="rounded-xl bg-primary-50 px-3.5 py-3">
          <dt className="text-[11px] font-medium text-primary-700">Actual to date</dt>
          <dd className="tnum mt-1 font-heading text-base font-bold text-neutral-900">
            {naira(actual)}
          </dd>
        </div>
      </dl>

      <div className="mt-4">
        <div
          className="h-2.5 overflow-hidden rounded-full bg-neutral-100"
          role="img"
          aria-label={`${pct} per cent of the approved budget spent`}
        >
          <div
            className={`h-full rounded-full ${over ? "bg-accent-500" : "bg-primary-600"}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="tnum mt-1.5 text-[11px] text-neutral-600">
          {pct}% of budget used · {over ? "over budget" : `${naira(EXPECTED - actual)} left`}
        </p>
      </div>

      <ul className="mt-4 space-y-2 border-t border-neutral-100 pt-3.5">
        {SPEND.map((row) => (
          <li key={row.source} className="flex items-baseline gap-3 text-xs">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-neutral-700">{row.source}</span>
              <span className="block truncate text-[11px] text-neutral-500">{row.who}</span>
            </span>
            <span className="tnum shrink-0 font-medium text-neutral-900">{naira(row.amount)}</span>
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Testing: a test sprint and its findings                        */
/* ------------------------------------------------------------------ */

const CASES: { id: string; title: string; result: "Passed" | "Failed" | "Not run" }[] = [
  { id: "TC-14", title: "Leave request reaches the right supervisor", result: "Passed" },
  { id: "TC-15", title: "Balance cannot go below zero", result: "Failed" },
  { id: "TC-16", title: "Payslip hidden from other staff", result: "Passed" },
  { id: "TC-17", title: "Session ends after password change", result: "Not run" },
];

const RESULT_STYLE: Record<string, string> = {
  Passed: "bg-primary-100 text-primary-700",
  Failed: "border border-dashed border-accent-600 text-accent-700",
  "Not run": "bg-neutral-100 text-neutral-600",
};

export function TestingFigure() {
  return (
    <MockFrame label="projects / hr-system / testing" hue="info">
      <div className="flex items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2.5 font-heading text-sm font-semibold text-neutral-900">
          <span
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-50"
            aria-hidden="true"
          >
            <FlaskConical className="h-3.5 w-3.5 text-primary-700" />
          </span>
          Test sprint 3: leave and payroll
        </p>
        <IllustrativePill />
      </div>

      <ul className="mt-4 space-y-2">
        {CASES.map((c) => (
          <li key={c.id} className="flex items-center gap-3 text-xs">
            <span className="tnum w-11 shrink-0 text-[11px] font-medium text-neutral-500">{c.id}</span>
            <span className="min-w-0 flex-1 truncate text-neutral-700">{c.title}</span>
            <span
              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${RESULT_STYLE[c.result]}`}
            >
              {c.result === "Passed" && <Check className="h-2.5 w-2.5" aria-hidden="true" />}
              {c.result}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 rounded-2xl bg-neutral-100 p-3.5">
        <p className="flex items-center gap-2 text-xs font-semibold text-neutral-900">
          <Bug className="h-4 w-4 shrink-0 text-accent-700" aria-hidden="true" />
          Finding → bug on the board
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-neutral-600">
          &ldquo;Balance can go negative when two requests overlap.&rdquo; Severity
          high · steps to reproduce · recommendation
        </p>
        <p className="mt-2 text-[11px] font-medium text-neutral-500">
          From TC-15 · assigned by the PM
        </p>
      </div>

      <p className="mt-3 flex items-center gap-2 text-[11px] text-neutral-600">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden="true" />
        QA and security analysts log the findings. The project manager assigns them.
      </p>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  3. From a spreadsheet or a brief to a dated backlog               */
/* ------------------------------------------------------------------ */

const PLAN: { level: "Epic" | "Story" | "Task"; title: string; meta: string }[] = [
  { level: "Epic", title: "Leave management", meta: "3 stories" },
  { level: "Story", title: "Staff request leave against a balance", meta: "5 pts" },
  { level: "Task", title: "Balance check on submit", meta: "6 h · 14 to 15 Oct" },
  { level: "Task", title: "Supervisor approval screen", meta: "9 h · 15 to 16 Oct" },
  { level: "Story", title: "HR adjusts a balance", meta: "3 pts" },
];

const INDENT: Record<string, string> = { Epic: "", Story: "pl-3 sm:pl-4", Task: "pl-6 sm:pl-8" };

const LEVEL_STYLE: Record<string, string> = {
  Epic: "bg-primary-600 text-white",
  Story: "bg-primary-100 text-primary-700",
  Task: "bg-neutral-100 text-neutral-600",
};

export function PlannerFigure() {
  return (
    <MockFrame label="projects / hr-system / generate" hue="info">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-700">
          <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden="true" />
          backlog.xlsx imported
        </span>
        <span className="text-[11px] text-neutral-500">or</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-50 px-2.5 py-1 text-[11px] font-medium text-primary-700">
          <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          Drafted by the AI planner
        </span>
        <span className="ml-auto">
          <IllustrativePill />
        </span>
      </div>

      <ul className="mt-4 space-y-1">
        {PLAN.map((row) => (
          <li
            key={row.title}
            className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-xs ${INDENT[row.level]} ${
              row.level === "Epic" ? "bg-primary-50/70" : ""
            }`}
          >
            <span
              className={`w-11 shrink-0 rounded-full py-0.5 text-center text-[10px] font-semibold ${LEVEL_STYLE[row.level]}`}
            >
              {row.level}
            </span>
            <span
              className={`min-w-0 flex-1 truncate ${
                row.level === "Epic" ? "font-semibold text-neutral-900" : "text-neutral-700"
              }`}
            >
              {row.title}
            </span>
            <span className="tnum hidden shrink-0 text-[11px] text-neutral-500 min-[400px]:inline">
              {row.meta}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 border-t border-neutral-100 pt-3 text-[11px] leading-relaxed text-neutral-600">
        The scheduler sets the dates from your team&apos;s real capacity. The AI
        drafts the work; it never guesses when it will be done.
      </p>
    </MockFrame>
  );
}
