"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import type { LabourException } from "@/lib/api/finance-labour-client";
import { Chip, cx } from "@/components/workspace/kit";
import { HUE } from "@/components/workspace/modules";
import { amount, compact } from "@/suite/finance/lib/format";
import { exceptionMeta, hoursText } from "./meta";

/* ------------------------------------------------------------------ */
/*  The split: where the month's payroll cost went                     */
/* ------------------------------------------------------------------ */

/** Shares of the loaded cost, in percent, for the split bar. Pure, for testing. */
export function splitShares(allocated: number, bench: number): { projects: number; bench: number } {
  const total = Math.max(0, allocated) + Math.max(0, bench);
  if (total <= 0) return { projects: 0, bench: 0 };
  const projects = (Math.max(0, allocated) / total) * 100;
  return { projects, bench: 100 - projects };
}

/**
 * The month's loaded payroll cost as one bar: the part charged to projects
 * in blue, the bench - paid time no project carries - in sun. The figures
 * sit above their halves so the words travel with the colour.
 */
export function LabourSplit({ loaded, allocated, bench, size = "lg" }: { loaded: number; allocated: number; bench: number; size?: "md" | "lg" }) {
  const s = splitShares(allocated, bench);
  const label = `Loaded cost ${compact(loaded)}: ${compact(allocated)} to projects (${Math.round(s.projects)}%), ${compact(bench)} on the bench (${Math.round(s.bench)}%).`;
  return (
    <div>
      <dl className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
            <span aria-hidden className={cx("h-2.5 w-2.5 rounded-sm", HUE.blue.dot)} />
            To projects
          </dt>
          <dd className={cx("mt-1 font-bold tracking-tight tabular-nums text-neutral-900", size === "lg" ? "text-2xl" : "text-lg")}>{compact(allocated)}</dd>
          <dd className="text-xs tabular-nums text-neutral-500">{Math.round(s.projects)}% of the cost</dd>
        </div>
        <div className="min-w-0 text-right">
          <dt className="flex items-center justify-end gap-1.5 text-xs font-medium text-neutral-600">
            <span aria-hidden className={cx("h-2.5 w-2.5 rounded-sm", HUE.sun.dot)} />
            Bench (overhead)
          </dt>
          <dd className={cx("mt-1 font-bold tracking-tight tabular-nums text-neutral-900", size === "lg" ? "text-2xl" : "text-lg")}>{compact(bench)}</dd>
          <dd className="text-xs tabular-nums text-neutral-500">{Math.round(s.bench)}% of the cost</dd>
        </div>
      </dl>
      <div role="img" aria-label={label} className={cx("ws-hatch mt-3 flex w-full gap-0.5 overflow-hidden rounded-full", size === "lg" ? "h-4" : "h-2.5")}>
        {s.projects > 0 && <span className={cx("h-full rounded-full", HUE.blue.bar)} style={{ width: `${s.projects}%` }} />}
        {s.bench > 0 && <span className={cx("h-full rounded-full", HUE.sun.bar)} style={{ width: `${s.bench}%` }} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Projects: hours, people and amount, with a bar each                */
/* ------------------------------------------------------------------ */

export interface ProjectShareRow {
  projectId: string;
  project: string | null;
  hours: number;
  people: number;
  amount: number;
  /** A word to show beside the name (e.g. the project is completed). */
  flag?: string | null;
}

export function ProjectShares({ rows, caption }: { rows: ProjectShareRow[]; caption: string }) {
  const top = Math.max(1, ...rows.map((r) => r.amount));
  const total = rows.reduce((s, r) => s + r.amount, 0);
  if (rows.length === 0) return <p className="px-5 pb-5 text-sm text-neutral-500">No hours were logged to a project, so nothing is charged to one.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
            <th scope="col" className="py-2.5 pl-5 pr-3">Project</th>
            <th scope="col" className="px-3 py-2.5 text-right">Hours</th>
            <th scope="col" className="px-3 py-2.5 text-right">People</th>
            <th scope="col" className="w-[34%] px-3 py-2.5">
              <span className="sr-only">Share</span>
            </th>
            <th scope="col" className="py-2.5 pl-3 pr-5 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.projectId} className="border-b border-neutral-100 last:border-b-0">
              <td className="py-3 pl-5 pr-3">
                <Link href={`/suite/finance/projects/${r.projectId}`} className="font-semibold text-neutral-900 outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                  {r.project ?? "Unnamed project"}
                </Link>
                {r.flag && (
                  <Chip hue="rose" className="ml-2">
                    {r.flag}
                  </Chip>
                )}
              </td>
              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-neutral-700">{hoursText(r.hours)}</td>
              <td className="px-3 py-3 text-right tabular-nums text-neutral-700">{r.people}</td>
              <td className="px-3 py-3">
                <span aria-hidden className="ws-hatch block h-2 w-full overflow-hidden rounded-full">
                  <span className={cx("block h-full rounded-full", HUE.blue.bar)} style={{ width: `${(r.amount / top) * 100}%` }} />
                </span>
              </td>
              <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right font-semibold tabular-nums text-neutral-900">{amount(r.amount)}</td>
            </tr>
          ))}
        </tbody>
        {rows.length > 1 && (
          <tfoot>
            <tr className="border-t border-neutral-200 font-semibold text-neutral-900">
              <th scope="row" className="py-3 pl-5 pr-3 text-left">
                Total
              </th>
              <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums">{hoursText(rows.reduce((s, r) => s + r.hours, 0))}</td>
              <td className="px-3 py-3" />
              <td className="px-3 py-3" />
              <td className="whitespace-nowrap py-3 pl-3 pr-5 text-right tabular-nums">{amount(total)}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exceptions, grouped by kind                                        */
/* ------------------------------------------------------------------ */

export interface ExceptionGroup {
  type: string;
  items: LabourException[];
  /** One sentence when every item says the same; otherwise each says its own. */
  message: string | null;
}

/** Exceptions grouped by kind, in the order the kinds first appear. Pure, for testing. */
export function groupExceptions(list: LabourException[]): ExceptionGroup[] {
  const groups = new Map<string, LabourException[]>();
  list.forEach((e) => groups.set(e.type, [...(groups.get(e.type) ?? []), e]));
  return [...groups.entries()].map(([type, items]) => ({
    type,
    items,
    message: items.every((i) => i.message === items[0].message) ? items[0].message : null,
  }));
}

/**
 * What the month's figures could not settle on their own: who logged no
 * hours, who logged too many, hours on a closed or unbudgeted project,
 * someone logging time who is not on the payroll. Grouped by kind, each with
 * its icon and its plain name, and who or what it is about when the reader
 * may see that.
 */
export function ExceptionList({ exceptions }: { exceptions: LabourException[] }) {
  if (exceptions.length === 0)
    return (
      <p className="flex items-center gap-2 text-sm text-mint-700">
        <CheckCircle2 size={16} aria-hidden />
        Nothing to check: everyone on the payroll logged hours within the standard month, all on open, budgeted projects.
      </p>
    );
  return (
    <ul className="space-y-3">
      {groupExceptions(exceptions).map((g) => {
        const m = exceptionMeta(g.type);
        const Icon = m.icon;
        const named = g.items.map((i) => i.name ?? i.project).filter((n): n is string => Boolean(n));
        return (
          <li key={g.type} className="flex items-start gap-3 rounded-xl border border-neutral-200/80 p-3.5">
            <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", HUE[m.hue].soft)}>
              <Icon size={18} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-neutral-900">
                {m.label}
                <span className="ml-1.5 font-normal tabular-nums text-neutral-500">
                  · {g.items.length} {g.type === "closed_project" || g.type === "no_budget" ? (g.items.length === 1 ? "project" : "projects") : g.items.length === 1 ? "person" : "people"}
                </span>
              </p>
              {g.message ? (
                <p className="mt-0.5 text-sm text-neutral-600">{g.message}</p>
              ) : (
                <ul className="mt-1 space-y-1 text-sm text-neutral-600">
                  {g.items.map((i, k) => (
                    <li key={k}>
                      {i.name && <span className="font-medium text-neutral-800">{i.name}: </span>}
                      {i.message}
                    </li>
                  ))}
                </ul>
              )}
              {g.message && named.length > 0 && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {named.map((n, k) => (
                    <Chip key={`${n}-${k}`} hue="slate">
                      {n}
                    </Chip>
                  ))}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
