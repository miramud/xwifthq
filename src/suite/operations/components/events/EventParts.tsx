"use client";

import Link from "next/link";
import { AlertTriangle, CircleCheckBig, FileStack, HandCoins, Luggage, Plane, ScrollText, ShoppingCart, type LucideIcon } from "lucide-react";
import { Chip, StatGrid, cx } from "@/components/workspace/kit";
import { GroupedColumns } from "@/components/workspace/charts";
import { HUE, type Hue } from "@/components/workspace/modules";
import { StatCard, humanise } from "@/suite/lms/components/ui/ws";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount, compact, day } from "@/suite/finance/lib/format";
import type { DashboardLine, EventDashboard, EventSummary, LineChannel, LinkedDoc } from "@/lib/api/operations-travel-client";
import { dateSpan, plural } from "../travel/labels";
import { FactRow } from "../travel/shared";
import { lineBars } from "./budget";
import { RichTextView } from "@/components/workspace/RichTextView";

/*
  An approved event's money, line by line: what was budgeted, what the
  PRs, orders, trips and advances raised from it have committed, and what
  Finance has paid - three bars on one scale, so a line running over shows
  at a glance. The documents behind each line are one click away.
*/

export const CHANNEL: Record<LineChannel, { label: string; hint: string; icon: LucideIcon; hue: Hue }> = {
  vendor: { label: "Vendor", hint: "Bought through a purchase request", icon: ShoppingCart, hue: "sky" },
  travel: { label: "Travel", hint: "Paid through a travel request", icon: Plane, hue: "grape" },
  advance: { label: "Advance", hint: "Paid as an advance to the lead", icon: HandCoins, hue: "coral" },
};

export const channel = (c: string) => CHANNEL[c as LineChannel] ?? { label: humanise(c), hint: "", icon: FileStack, hue: "slate" as Hue };

/** Budget, committed and paid for one line, as three labelled bars. */
export function LineBarsView({ line }: { line: Pick<DashboardLine, "budget" | "committed" | "paid"> }) {
  const b = lineBars(line);
  const rows: { key: string; label: string; value: number; pct: number; fill: string }[] = [
    { key: "budget", label: "Budget", value: line.budget, pct: b.budgetPct, fill: "bg-primary-500" },
    { key: "committed", label: "Committed", value: line.committed, pct: b.committedPct, fill: b.over ? "bg-rose-500" : "bg-grape-500" },
    { key: "paid", label: "Paid", value: line.paid, pct: b.paidPct, fill: "bg-mint-500" },
  ];
  return (
    <div>
      <dl className="space-y-2" aria-label={`Budget ${amount(line.budget)}, committed ${amount(line.committed)}, paid ${amount(line.paid)}`}>
        {rows.map((r) => (
          <div key={r.key} className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[5.5rem_minmax(0,1fr)_8.5rem]">
            <dt className="text-xs font-medium text-neutral-600">{r.label}</dt>
            <dd className="ws-hatch h-2.5 overflow-hidden rounded-full sm:order-none" aria-hidden>
              <span data-bar={r.key} className={cx("block h-full rounded-full transition-[width] duration-500", r.fill)} style={{ width: `${r.pct}%` }} />
            </dd>
            <dd className="col-span-2 -mt-1 text-right text-xs sm:col-span-1 sm:mt-0">
              <Money value={r.value} className="font-semibold text-neutral-900" />
            </dd>
          </div>
        ))}
      </dl>
      {b.over && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-700">
          <AlertTriangle size={13} aria-hidden />
          Committed {amount(-b.available)} beyond the line&apos;s budget
        </p>
      )}
    </div>
  );
}

export interface DocLinks {
  request: (d: LinkedDoc) => string | null;
  order: (d: LinkedDoc) => string | null;
  trip: (d: LinkedDoc) => string | null;
}

/**
 * The dashboard: totals, a chart of every line, then each line as a card
 * with its bars, channel, linked documents and (for the lead) its actions.
 */
export function BudgetDashboard({
  dashboard,
  links,
  actions,
}: {
  dashboard: EventDashboard;
  links: DocLinks;
  actions?: (line: DashboardLine) => React.ReactNode;
}) {
  const d = dashboard;
  const available = d.totals.budget - d.totals.committed;
  return (
    <div className="space-y-5">
      <StatGrid>
        <StatCard featured label="Budget" value={compact(d.totals.budget)} icon={FileStack} hint={amount(d.totals.budget)} />
        <StatCard label="Committed" value={compact(d.totals.committed)} icon={ScrollText} hue="grape" hint={`${pctOf(d.totals.committed, d.totals.budget)} of the budget`} />
        <StatCard label="Paid" value={compact(d.totals.paid)} icon={CircleCheckBig} hue="mint" hint={`${pctOf(d.totals.paid, d.totals.budget)} of the budget`} />
        <StatCard
          label="Left to commit"
          value={compact(available)}
          icon={HandCoins}
          hue={available < 0 ? "rose" : "sky"}
          hint={d.totals.participants > 0 ? `${amount(Math.round(d.totals.budget / d.totals.participants))} a participant` : "No participants set"}
        />
      </StatGrid>

      {d.lines.length > 0 && (
        <section aria-labelledby="lines-chart" className="ws-card p-5">
          <h3 id="lines-chart" className="mb-4 text-[15px] font-semibold text-neutral-900">
            Every line, budget against committed and paid
          </h3>
          <GroupedColumns
            data={d.lines.map((l) => ({ label: `${l.lineNo}. ${l.label}`, values: { budget: l.budget, committed: l.committed, paid: l.paid } }))}
            series={[
              { key: "budget", label: "Budget", hue: "blue" },
              { key: "committed", label: "Committed", hue: "grape" },
              { key: "paid", label: "Paid", hue: "mint" },
            ]}
            format={(v) => compact(v)}
            caption="Budget, committed and paid by line"
          />
        </section>
      )}

      <ul className="grid gap-4 lg:grid-cols-2" aria-label="Budget lines">
        {d.lines.map((l) => (
          <li key={l.id}>
            <LineCard line={l} links={links} actions={actions} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function pctOf(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%";
}

function LineCard({ line: l, links, actions }: { line: DashboardLine; links: DocLinks; actions?: (line: DashboardLine) => React.ReactNode }) {
  const ch = channel(l.channel);
  const docs = [
    ...l.requests.map((d) => ({ d, kind: "Purchase request", icon: ShoppingCart, href: links.request(d) })),
    ...l.orders.map((d) => ({ d, kind: "Order", icon: ScrollText, href: links.order(d) })),
    ...l.trips.map((d) => ({ d, kind: "Trip", icon: Luggage, href: links.trip(d) })),
  ];
  return (
    <article className="ws-card flex h-full flex-col p-5" aria-label={`Line ${l.lineNo}: ${l.description}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Line {l.lineNo} · {l.label}
          </p>
          <p className="mt-0.5 text-[15px] font-semibold text-neutral-900">{l.description}</p>
        </div>
        <Chip hue={ch.hue} icon={ch.icon}>
          {ch.label}
        </Chip>
      </div>
      <div className="mt-4">
        <LineBarsView line={l} />
      </div>
      <div className="mt-4 border-t border-neutral-100 pt-3">
        {docs.length === 0 ? (
          <p className="text-xs text-neutral-500">Nothing raised from this line yet. {ch.hint}.</p>
        ) : (
          <ul className="space-y-1.5" aria-label={`Raised from line ${l.lineNo}`}>
            {docs.map(({ d, kind, icon: Icon, href }) => (
              <li key={`${kind}-${d.id}`} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cx("flex h-6 w-6 shrink-0 items-center justify-center rounded-md", HUE.slate.soft)}>
                    <Icon size={13} aria-hidden />
                  </span>
                  {href ? (
                    <Link href={href} className="truncate font-semibold text-primary-700 underline-offset-2 hover:underline">
                      {d.number ?? `Draft ${kind.toLowerCase()}`}
                    </Link>
                  ) : (
                    <span className="truncate font-semibold text-neutral-800">{d.number ?? `Draft ${kind.toLowerCase()}`}</span>
                  )}
                  <span className="hidden truncate text-xs text-neutral-500 sm:inline">{humanise(d.status)}</span>
                </span>
                <Money value={d.amount} className="shrink-0 text-xs font-semibold text-neutral-700" />
              </li>
            ))}
          </ul>
        )}
      </div>
      {actions && <div className="mt-auto pt-4">{actions(l)}</div>}
    </article>
  );
}

/** What still stops the event closing; an empty list says it can close. */
export function Blockers({ blockers }: { blockers: string[] }) {
  if (blockers.length === 0) {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-mint-700">
        <CircleCheckBig size={16} aria-hidden />
        Nothing is holding it open: every service is confirmed and every advance retired.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {blockers.map((b) => (
        <li key={b} className="flex items-start gap-2 rounded-xl bg-sun-50 px-3 py-2.5 text-sm text-sun-700 ring-1 ring-sun-500/30">
          <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
          {b}
        </li>
      ))}
    </ul>
  );
}

/** A draft's or a sent event's budget, before the dashboard exists: each line, its channel and the total. */
export function BudgetLines({ lines, categories }: { lines: { id: string; lineNo: number; category: string; description: string; amount: number; channel: string }[]; categories: Record<string, string> }) {
  if (lines.length === 0) return <p className="text-sm text-neutral-500">No budget lines yet. Edit the draft to add them.</p>;
  const total = lines.reduce((s, l) => s + l.amount, 0);
  return (
    <div>
      <ul className="divide-y divide-neutral-100">
        {lines.map((l) => {
          const ch = channel(l.channel);
          return (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 py-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-neutral-900">
                  {l.lineNo}. {l.description}
                </span>
                <span className="block text-xs text-neutral-500">{categories[l.category] ?? humanise(l.category)}</span>
              </span>
              <span className="flex items-center gap-3">
                <Chip hue={ch.hue} icon={ch.icon} className="!px-2 !py-0.5 !text-[11px]">
                  {ch.label}
                </Chip>
                <Money value={l.amount} className="w-32 text-right text-sm font-semibold text-neutral-900" />
              </span>
            </li>
          );
        })}
      </ul>
      <p className="flex items-baseline justify-between gap-3 border-t border-neutral-200 pt-3">
        <span className="text-sm font-semibold text-neutral-700">Total budget</span>
        <Money value={total} className="text-lg font-bold text-neutral-900" />
      </p>
    </div>
  );
}

/** When, where, who and for whom. */
export function EventFacts({ event: e }: { event: EventSummary }) {
  return (
    <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
      <FactRow label="Dates">{dateSpan(e.startsOn, e.endsOn)}</FactRow>
      <FactRow label="Location">{e.location || <span className="text-neutral-500">Not set</span>}</FactRow>
      <FactRow label="Participants">
        {plural(e.participantsInternal, "member of staff", "staff")} and {plural(e.participantsExternal, "external guest")}
      </FactRow>
      <FactRow label="Lead">{e.lead ?? "-"}</FactRow>
      <FactRow label="Charged to">{e.project ? `${e.project.name}${e.project.code ? ` (${e.project.code})` : ""}` : "A cost centre"}</FactRow>
      <FactRow label="Kind">{e.typeLabel}</FactRow>
      {e.objectives && (
        <FactRow label="Objectives" className="sm:col-span-2">
          <RichTextView value={e.objectives} size="sm" />
        </FactRow>
      )}
      {e.closedAt && (
        <>
          <FactRow label="Attended">{e.attendance ?? "-"}</FactRow>
          <FactRow label="Closed">{day(e.closedAt)}</FactRow>
          {e.outcomes && (
            <FactRow label="Outcomes" className="sm:col-span-2">
              <RichTextView value={e.outcomes} size="sm" />
            </FactRow>
          )}
        </>
      )}
    </dl>
  );
}
