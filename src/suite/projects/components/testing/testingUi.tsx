"use client";

import {
  Ban,
  CheckCircle2,
  CircleDashed,
  Globe,
  MonitorSmartphone,
  ShieldAlert,
  SkipForward,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Chip, cx } from "@/components/workspace/kit";
import { HUE, type Hue } from "@/components/workspace/modules";
import type {
  FindingCategory,
  FindingSeverity,
  TestCaseCategory,
  TestLevel,
  TestRunStatus,
  TestSprintFocus,
} from "@/lib/api/projects-client";

/*
  The testing vocabulary, drawn one way everywhere: a severity, a run's
  outcome and a test level are the same word, icon and hue in the test
  sprint, the library, the test backlog and the item panel.
*/

export const SEVERITY_META: Record<FindingSeverity, { label: string; hue: Hue; hint: string }> = {
  critical: { label: "Critical", hue: "rose", hint: "Data exposed, money or access at risk, or the product is unusable." },
  high: { label: "High", hue: "coral", hint: "A main path is broken or a serious weakness, with no workaround." },
  medium: { label: "Medium", hue: "sun", hint: "Wrong behaviour with a workaround, or a weakness that needs other conditions." },
  low: { label: "Low", hue: "sky", hint: "Minor or cosmetic; nobody is blocked." },
  info: { label: "Informational", hue: "slate", hint: "Worth knowing; nothing is wrong yet." },
};

export const SEVERITY_ORDER: FindingSeverity[] = ["critical", "high", "medium", "low", "info"];

export const FINDING_CATEGORY_LABEL: Record<FindingCategory, string> = {
  functional: "Functional",
  security: "Security",
  performance: "Performance",
  usability: "Usability",
  accessibility: "Accessibility",
  compatibility: "Compatibility",
  data: "Data integrity",
};

export const CASE_CATEGORY_LABEL: Record<TestCaseCategory, string> = {
  functional: "Functional",
  negative: "Negative",
  boundary: "Boundary",
  security: "Security",
  performance: "Performance",
  accessibility: "Accessibility",
  integration: "Integration",
};

export const FOCUS_META: Record<TestSprintFocus, { label: string; hint: string }> = {
  functional: { label: "Functional QA", hint: "Every acceptance criterion, positive and negative, at UI and API level." },
  security: { label: "Security assessment", hint: "Access control, injection, sessions and data exposure, with remediations." },
  regression: { label: "Regression", hint: "Prove what already worked still does." },
  full: { label: "Functional and security", hint: "Both, in one pass." },
};

export const RUN_META: Record<TestRunStatus, { label: string; hue: Hue; icon: LucideIcon; bar: string }> = {
  passed: { label: "Passed", hue: "mint", icon: CheckCircle2, bar: "bg-gradient-to-r from-mint-500 to-mint-400" },
  failed: { label: "Failed", hue: "rose", icon: XCircle, bar: "bg-gradient-to-r from-rose-500 to-rose-400" },
  blocked: { label: "Blocked", hue: "sun", icon: Ban, bar: "bg-gradient-to-r from-sun-500 to-sun-300" },
  skipped: { label: "Skipped", hue: "slate", icon: SkipForward, bar: "bg-neutral-400" },
  not_run: { label: "Not run", hue: "slate", icon: CircleDashed, bar: "" },
};

/** The order a tester reads a plan in: what is done, then what is not. */
export const RUN_ORDER: TestRunStatus[] = ["passed", "failed", "blocked", "skipped", "not_run"];

export function SeverityChip({ severity }: { severity: FindingSeverity | null | undefined }) {
  if (!severity) return <Chip hue="slate">Unclassified</Chip>;
  const meta = SEVERITY_META[severity];
  return (
    <Chip hue={meta.hue} dot>
      {meta.label}
    </Chip>
  );
}

export function RunChip({ status }: { status: TestRunStatus }) {
  const meta = RUN_META[status];
  return (
    <Chip hue={meta.hue} icon={meta.icon}>
      {meta.label}
    </Chip>
  );
}

export function LevelChip({ level }: { level: TestLevel }) {
  return level === "api" ? (
    <Chip hue="grape" icon={Globe}>
      API
    </Chip>
  ) : (
    <Chip hue="sky" icon={MonitorSmartphone}>
      UI
    </Chip>
  );
}

export function CaseCategoryChip({ category }: { category: TestCaseCategory }) {
  return category === "security" ? (
    <Chip hue="rose" icon={ShieldAlert}>
      Security
    </Chip>
  ) : (
    <Chip hue="slate">{CASE_CATEGORY_LABEL[category]}</Chip>
  );
}

/** "POST /api/leave-requests → 422", the line an API case is run from. */
export function ApiLine({
  method,
  path,
  status,
}: {
  method: string | null;
  path: string | null;
  status: number | null;
}) {
  if (!method && !path && status === null) return null;
  return (
    <p className="flex flex-wrap items-center gap-2 rounded-xl bg-neutral-900 px-3 py-2 font-mono text-[12.5px] text-neutral-100">
      {method && <span className="font-bold text-sky-100">{method}</span>}
      {path && <span className="break-all">{path}</span>}
      {status !== null && (
        <>
          <span className="text-neutral-400" aria-hidden>
            →
          </span>
          <span className={cx("font-bold", status < 400 ? "text-mint-100" : "text-sun-400")}>{status}</span>
          <span className="sr-only">expected status</span>
        </>
      )}
    </p>
  );
}

/**
 * The plan as one bar: passed, failed, blocked and skipped as solid
 * segments, and what is not run yet as the workspace hatch - "not yet" is
 * texture, never an empty trough. The counts are written beside it, so the
 * colour is never the only signal.
 */
export function RunStrip({
  counts,
  total,
  size = "md",
  showLegend = true,
}: {
  counts: Partial<Record<TestRunStatus, number>>;
  total: number;
  size?: "sm" | "md";
  showLegend?: boolean;
}) {
  const judged: TestRunStatus[] = ["passed", "failed", "blocked", "skipped"];
  const label = RUN_ORDER.map((s) => `${counts[s] ?? 0} ${RUN_META[s].label.toLowerCase()}`).join(", ");

  return (
    <div>
      <div
        role="img"
        aria-label={total === 0 ? "No cases planned" : `${total} cases: ${label}`}
        className={cx("ws-hatch flex w-full overflow-hidden rounded-full", size === "sm" ? "h-2" : "h-3")}
      >
        {total > 0 &&
          judged.map((s) => {
            const n = counts[s] ?? 0;
            return n === 0 ? null : (
              <span key={s} className={cx("h-full", RUN_META[s].bar)} style={{ width: `${(n / total) * 100}%` }} />
            );
          })}
      </div>
      {showLegend && (
        <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
          {RUN_ORDER.map((s) => (
            <li key={s} className="flex items-center gap-1.5">
              <span
                className={cx("h-2 w-2 rounded-full", s === "not_run" ? "ws-hatch ring-1 ring-neutral-300" : RUN_META[s].bar)}
                aria-hidden
              />
              <span className="font-semibold tabular-nums text-neutral-900">{counts[s] ?? 0}</span>
              {RUN_META[s].label.toLowerCase()}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Open findings by severity as five small tiles, most severe first. */
export function SeverityTiles({
  counts,
  className,
}: {
  counts: Partial<Record<FindingSeverity, number>>;
  className?: string;
}) {
  return (
    <ul className={cx("grid grid-cols-5 gap-2", className)}>
      {SEVERITY_ORDER.map((s) => {
        const n = counts[s] ?? 0;
        const meta = SEVERITY_META[s];
        return (
          <li
            key={s}
            className={cx(
              "flex flex-col items-center rounded-2xl px-1 py-2.5 text-center",
              n > 0 ? HUE[meta.hue].soft : "bg-neutral-50 text-neutral-500",
            )}
          >
            <span className="text-lg font-bold leading-none tabular-nums">{n}</span>
            <span className="mt-1 text-[11px] font-semibold">{s === "info" ? "Info" : meta.label}</span>
          </li>
        );
      })}
    </ul>
  );
}
