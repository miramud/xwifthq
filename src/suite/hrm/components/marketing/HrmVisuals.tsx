import { ArrowDown, Banknote, Check, Lock } from "lucide-react";
import { MockFrame } from "@/components/platform/MockFrame";

/**
 * The four drawn figures on the HRM product page.
 *
 * Everything here is markup: boxes, borders, inline rules and lucide glyphs.
 * Nothing is a screenshot and nothing pretends to be one. The figures are
 * obviously simplified, and every number in them is labelled illustrative.
 *
 * Each figure is a white frame floating on a soft purple glow (`.xw-frame`),
 * with rounded inner cards and round badges. Purple carries the chrome and the
 * connectors; violet, the hue HRM is labelled with, marks the data accents
 * only. No figure asks colour to carry meaning on its own: every state that
 * matters also carries a word, a letter or a number.
 */

/** The small "Illustrative" pill every figure wears in its corner. */
function Illustrative() {
  return (
    <span className="shrink-0 rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-[11px] font-semibold text-primary-700">
      Illustrative
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  1. The org tree                                                    */
/* ------------------------------------------------------------------ */

interface TreeNode {
  title: string;
  meta: string;
  vacant?: boolean;
}

const LEVEL_TWO: TreeNode[] = [
  { title: "Operations", meta: "Director" },
  { title: "Finance & Admin", meta: "Director" },
  { title: "People", meta: "Director" },
];

const LEVEL_THREE: TreeNode[] = [
  { title: "Regional Coordinator", meta: "M3 · filled" },
  { title: "Payroll Officer", meta: "M2 · filled" },
  { title: "HR Officer", meta: "M2 · vacant", vacant: true },
];

function TreeBox({ node }: { node: TreeNode }) {
  return (
    <div
      className={`rounded-xl border px-2 py-2 text-center ${
        node.vacant
          ? "border-dashed border-neutral-300 bg-neutral-50"
          : "border-primary-200 bg-white"
      }`}
    >
      <p
        className={`text-[11px] font-semibold leading-tight ${
          node.vacant ? "text-neutral-500" : "text-neutral-900"
        }`}
      >
        {node.title}
      </p>
      <p className="mt-1 text-[10px] leading-tight text-neutral-500">
        {node.meta}
      </p>
    </div>
  );
}

/** A stub joining a box to whatever sits above it. */
function Stub() {
  return (
    <span className="h-4 w-px shrink-0 bg-primary-200" aria-hidden="true" />
  );
}

export function OrgTreeFigure() {
  return (
    <div className="xw-frame p-4 sm:p-7">
      <div className="mx-auto max-w-xs">
        <TreeBox node={{ title: "Managing Director", meta: "Top of the structure" }} />
      </div>

      <div className="flex justify-center">
        <Stub />
      </div>

      <div className="relative">
        {/* The bar that joins the three second-level boxes. Decorative. */}
        <span
          className="absolute left-[16.666%] right-[16.666%] top-0 h-px bg-primary-200"
          aria-hidden="true"
        />
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {LEVEL_TWO.map((node) => (
            <div key={node.title} className="flex flex-col items-center">
              <Stub />
              <div className="w-full">
                <TreeBox node={node} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/*
        Below `sm` the third level is dropped rather than shrunk. Three boxes
        of three-word titles across a 360px screen is either a horizontal
        scrollbar or unreadable type, and two levels still show the shape.
      */}
      <div className="hidden grid-cols-3 gap-3 sm:grid">
        {LEVEL_THREE.map((node) => (
          <div key={node.title} className="flex flex-col items-center">
            <Stub />
            <div className="w-full">
              <TreeBox node={node} />
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 flex items-center justify-center gap-2 text-xs text-neutral-500">
        <span
          className="h-3 w-5 shrink-0 rounded-md border border-dashed border-neutral-300"
          aria-hidden="true"
        />
        Dashed box: an approved role that is still open
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. The leave calendar                                              */
/* ------------------------------------------------------------------ */

type LeaveCode = "A" | "S" | "P" | "T";

const LEAVE_LEGEND: { code: LeaveCode; label: string; swatch: string }[] = [
  { code: "A", label: "Annual leave", swatch: "bg-violet-500/15 text-violet-700" },
  { code: "S", label: "Sick leave", swatch: "bg-info-500/10 text-info-600" },
  { code: "P", label: "Public holiday", swatch: "bg-neutral-900/8 text-neutral-700" },
  // Gold is the one colour that cannot carry white text, and accent-500 is too
  // pale to be read as text at all. So the tint is gold and the glyph is
  // accent-700, which is the value that clears 4.5:1 on white.
  { code: "T", label: "Training day", swatch: "bg-accent-500/15 text-accent-700" },
];

const SWATCH: Record<LeaveCode, string> = LEAVE_LEGEND.reduce(
  (map, entry) => ({ ...map, [entry.code]: entry.swatch }),
  {} as Record<LeaveCode, string>,
);

/** Day-of-month → the code marked against it. Illustrative. */
const MARKED: Record<number, LeaveCode> = {
  4: "A",
  5: "A",
  6: "A",
  12: "S",
  18: "T",
  19: "T",
  23: "P",
  26: "A",
  27: "A",
};

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function LeaveCalendarFigure() {
  // A 30-day month that starts on a Wednesday: two leading blanks, then 1 to 30.
  const cells: (number | null)[] = [
    null,
    null,
    ...Array.from({ length: 30 }, (_, i) => i + 1),
  ];

  return (
    <MockFrame label="Leave, team calendar" hue="violet" className="xw-frame">
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-sm font-semibold text-neutral-900">
          Operations · September
        </p>
        <Illustrative />
      </div>

      <div
        className="mt-4 grid grid-cols-7 gap-1"
        aria-hidden="true"
      >
        {WEEKDAYS.map((day, index) => (
          <span
            key={`${day}-${index}`}
            className="py-1 text-center text-[10px] font-semibold text-neutral-500"
          >
            {day}
          </span>
        ))}
      </div>

      <div
        className="mt-1 grid grid-cols-7 gap-1"
        role="img"
        aria-label="Illustrative team calendar for one month, marking annual leave, a sick day, two training days and a public holiday"
      >
        {cells.map((day, index) => {
          if (day === null) {
            return <span key={`blank-${index}`} className="aspect-square" />;
          }
          const code = MARKED[day];
          return (
            <span
              key={day}
              className={`flex aspect-square flex-col items-center justify-center gap-px rounded-lg leading-none ${
                code ? SWATCH[code] : "bg-neutral-50 text-neutral-500"
              }`}
            >
              <span className="tnum text-[10px]">{day}</span>
              <span className="text-[8px] font-bold">{code ?? " "}</span>
            </span>
          );
        })}
      </div>

      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 border-t border-neutral-100 pt-4">
        {LEAVE_LEGEND.map((entry) => (
          <li
            key={entry.code}
            className="flex items-center gap-1.5 text-[11px] text-neutral-600"
          >
            <span
              className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold ${entry.swatch}`}
              aria-hidden="true"
            >
              {entry.code}
            </span>
            {entry.label}
          </li>
        ))}
      </ul>
    </MockFrame>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Payroll run into the ledger                                     */
/* ------------------------------------------------------------------ */

const RUN_SUMMARY: { label: string; value: string; strong?: boolean }[] = [
  { label: "Gross pay", value: "18,420,000" },
  { label: "Deductions", value: "(4,155,400)" },
  { label: "Net pay", value: "14,264,600", strong: true },
  { label: "Employer cost", value: "20,262,000" },
];

/**
 * The journal the run posts. It balances (20,262,000 on each side) because a
 * figure in a drawing of an accounting system that does not add up is the one
 * detail an accountant reading this page will check.
 */
const JOURNAL: { side: "Dr" | "Cr"; account: string; value: string }[] = [
  { side: "Dr", account: "Staff costs: Operations", value: "11,180,000" },
  { side: "Dr", account: "Staff costs: Field", value: "7,240,000" },
  { side: "Dr", account: "Employer pension", value: "1,842,000" },
  { side: "Cr", account: "PAYE payable", value: "2,486,700" },
  { side: "Cr", account: "Pension payable", value: "3,315,600" },
  { side: "Cr", account: "NHF payable", value: "195,100" },
  { side: "Cr", account: "Net pay control", value: "14,264,600" },
];

export function PayrollJournalFigure() {
  return (
    <div>
      <div className="xw-frame p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-heading text-sm font-semibold text-neutral-900">
            Payroll run · September
          </p>
          <Illustrative />
        </div>
        <p className="mt-1 text-[11px] text-neutral-500">
          148 employees · 1 entity · naira
        </p>

        <dl className="mt-4 space-y-2">
          {RUN_SUMMARY.map((row) => (
            <div
              key={row.label}
              className="flex items-baseline justify-between gap-4 border-b border-neutral-100 pb-2 last:border-0 last:pb-0"
            >
              <dt className="text-xs text-neutral-500">{row.label}</dt>
              <dd
                className={`tnum text-sm ${
                  row.strong
                    ? "font-semibold text-neutral-900"
                    : "text-neutral-700"
                }`}
              >
                &#8358;{row.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="flex flex-col items-center py-3" aria-hidden="true">
        <span className="h-4 w-px bg-primary-200" />
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary-600 text-white shadow-[0_8px_20px_-10px_rgb(150_56_205/0.8)]">
          <ArrowDown className="h-4 w-4" />
        </span>
        <span className="h-4 w-px bg-primary-200" />
      </div>

      <div className="xw-frame p-5">
        <div className="flex items-center justify-between gap-3">
          <p className="font-heading text-sm font-semibold text-neutral-900">
            General ledger journal
          </p>
          <p className="tnum text-[11px] font-semibold text-neutral-500">JV-0912</p>
        </div>

        <ul className="mt-4 space-y-1.5">
          {JOURNAL.map((line) => (
            <li
              key={`${line.side}-${line.account}`}
              className="flex items-baseline gap-2.5 text-xs"
            >
              <span className="w-5 shrink-0 text-[11px] font-semibold text-neutral-500">
                {line.side}
              </span>
              <span
                className={`min-w-0 flex-1 truncate text-neutral-600 ${
                  line.side === "Cr" ? "pl-3" : ""
                }`}
              >
                {line.account}
              </span>
              <span className="tnum shrink-0 text-neutral-900">
                &#8358;{line.value}
              </span>
            </li>
          ))}
        </ul>

        <p className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-primary-50 px-3 py-2.5 text-xs">
          <span className="font-medium text-primary-700">Balanced on both sides</span>
          <span className="tnum font-semibold text-neutral-900">
            &#8358;20,262,000
          </span>
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. The leaver's clearance and final pay                            */
/* ------------------------------------------------------------------ */

type ClearState = "cleared" | "held";

const CLEARANCE: {
  item: string;
  owner: string;
  state: ClearState;
  note: string;
}[] = [
  { item: "Exit interview", owner: "HR", state: "cleared", note: "Recorded" },
  { item: "System access", owner: "HR", state: "cleared", note: "Revoked, on the audit trail" },
  { item: "Laptop AST-0418", owner: "Admin", state: "held", note: "Still assigned" },
  { item: "Travel advance", owner: "Finance", state: "held", note: "Not yet retired" },
];

/**
 * The exit, drawn as the checklist it really is. The point of the figure is
 * the last row: final pay cannot be released while the asset register or the
 * advances ledger still names the person. That is HRM reading Admin and
 * Finance rather than trusting somebody's email.
 */
export function LeaverClearanceFigure() {
  const held = CLEARANCE.filter((row) => row.state === "held").length;

  return (
    <MockFrame label="Leavers, clearance" hue="violet" className="xw-frame">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 font-heading text-sm font-semibold text-neutral-900">
          Leaver · last working day 31 Oct
        </p>
        <Illustrative />
      </div>

      <ul className="mt-4 space-y-2">
        {CLEARANCE.map((row) => (
          <li
            key={row.item}
            className="flex items-center gap-3 rounded-xl border border-neutral-200 px-3 py-2.5"
          >
            <span
              className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                row.state === "cleared"
                  ? "bg-primary-100 text-primary-700"
                  : "border border-dashed border-accent-600 bg-accent-500/10 text-accent-700"
              }`}
            >
              {row.state === "cleared" ? (
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-neutral-900">
                {row.item}
              </span>
              <span className="block truncate text-[11px] text-neutral-500">
                {row.note}
              </span>
            </span>
            <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] font-semibold text-neutral-600">
              {row.owner}
            </span>
            <span className="sr-only">
              {row.state === "cleared" ? "cleared" : "holding final pay"}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-4 flex items-center gap-2.5 rounded-xl bg-primary-50 px-3 py-2.5 text-xs text-neutral-700">
        <Banknote className="h-4 w-4 shrink-0 text-primary-600" aria-hidden="true" />
        <span>
          Final pay <span className="font-semibold text-neutral-900">held</span>:{" "}
          <span className="tnum">{held}</span> items still open in Admin and
          Finance
        </span>
      </p>
    </MockFrame>
  );
}
