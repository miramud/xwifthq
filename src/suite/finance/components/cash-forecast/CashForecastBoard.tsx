"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronDown, ChevronRight, CircleAlert, Clock, Download, Landmark, LineChart, ShieldCheck, Waves } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Card, Chip, Empty, PageHeader, Panel, Segmented, cx } from "@/components/workspace/kit";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { CalendarNav, MonthCalendar, monthTitle, type CalendarEvent } from "@/components/workspace/Calendar";
import { HUE } from "@/components/workspace/modules";
import { Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { KIND_ORDER, cashForecast, errorText, itemsByKind, kindTotals, type CashForecast, type ForecastItem } from "@/lib/api/finance-budgets-client";
import { CashRunwayChart } from "./CashRunwayChart";
import { RecurringPanel, SettingsPanel } from "./ForecastPanels";
import { KIND, dayShort, weekRange } from "./meta";

/**
 * Finance › Cash forecast (Finance PRD §13): thirteen weeks from today.
 * Opening cash from the bank accounts; in, what clients are due to pay and
 * the contract pipeline at its probability; out, vouchers, cleared requests,
 * payroll, PAYE and pension, and recurring items. The lowest point leads,
 * because that is the question: will we run short, and when.
 */

export default function CashForecastBoard() {
  const { user } = useAuth();
  const [data, setData] = useState<CashForecast | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [view, setView] = useState<"chart" | "calendar">("chart");
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    cashForecast.get().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`The forecast didn't load. ${errorText(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const changed = (m: string) => {
    setNotice(m);
    setReload((n) => n + 1);
  };

  const header = (
    <PageHeader
      eyebrow="Treasury"
      title="Cash forecast"
      subtitle={data ? `Thirteen weeks from ${day(data.asOf)}, built from the books and the registers.` : "Thirteen weeks of cash, built from the books and the registers."}
    />
  );

  if (error && !data)
    return (
      <div>
        {header}
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!data)
    return (
      <div aria-busy="true">
        {header}
        <p className="sr-only">Loading the cash forecast…</p>
        <Skeleton className="mb-5 h-44" />
        <div className="mb-5 grid gap-5 xl:grid-cols-3">
          <Skeleton className="h-96 xl:col-span-2" />
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-96" />
      </div>
    );

  const can = {
    create: mayDo(user, "cash_forecast", "create_item"),
    update: mayDo(user, "cash_forecast", "update_item"),
    remove: mayDo(user, "cash_forecast", "delete_item"),
    settings: mayDo(user, "cash_forecast", "update_settings"),
  };
  const pick = (i: number) => {
    setOpen(i);
    requestAnimationFrame(() => document.getElementById(`cf-week-${i}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
  };

  return (
    <div>
      {header}
      <Notice text={notice} />
      <div className="space-y-5">
        <Headline data={data} onPick={pick} />

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="The next thirteen weeks"
            subtitle={view === "chart" ? "Money in and out each week, and the cash left at the end of it" : "Every expected receipt and payment on its day"}
            icon={view === "chart" ? LineChart : CalendarDays}
            actions={
              <Segmented
                label="Forecast view"
                value={view}
                onChange={setView}
                options={[
                  { key: "chart", label: "Weeks" },
                  { key: "calendar", label: "Calendar" },
                ]}
              />
            }
          >
            {view === "chart" ? (
              <CashRunwayChart weeks={data.weeks} threshold={data.threshold} format={(v) => compact(v)} selected={open} onSelect={pick} />
            ) : (
              <ForecastCalendar data={data} />
            )}
          </Panel>
          <div className="space-y-5">
            <OpeningCash data={data} />
            <WhatMoves items={data.items} />
          </div>
        </div>

        <WeeksTable data={data} open={open} onToggle={(i) => setOpen((o) => (o === i ? null : i))} />

        <div className="grid gap-5 xl:grid-cols-3">
          <RecurringPanel items={data.recurring} can={can} onChanged={changed} />
          <SettingsPanel key={`${data.settings.overdueCollectionPct}-${data.settings.pipelinePct}`} settings={data.settings} canUpdate={can.settings} onChanged={changed} />
          <SourcesPanel />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  The headline: the lowest point, and the ends of the runway         */
/* ------------------------------------------------------------------ */

function Headline({ data, onPick }: { data: CashForecast; onPick: (i: number) => void }) {
  const low = data.lowest;
  const last = data.weeks[data.weeks.length - 1];
  const lowWeeks = data.weeks.filter((w) => w.low || w.negative);
  const totalIn = data.weeks.reduce((s, w) => s + w.inflows, 0);
  const totalOut = data.weeks.reduce((s, w) => s + w.outflows, 0);
  const state = !low ? null : low.negative ? "negative" : low.low ? "low" : "ok";

  return (
    <Card className="relative overflow-hidden p-5 sm:p-7">
      <span aria-hidden className={cx("pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full", state === "ok" ? "bg-mint-50" : "bg-rose-50")} />
      <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <p className="text-sm font-medium text-neutral-500">Lowest point in the next thirteen weeks</p>
          {low ? (
            <>
              <p className={cx("mt-1 text-[40px] font-bold leading-none tracking-tight tabular-nums sm:text-[48px]", state === "ok" ? "text-neutral-900" : "text-rose-700")}>{compact(low.closing)}</p>
              <p className="mt-2 text-sm text-neutral-600">
                At the end of{" "}
                <button type="button" onClick={() => onPick(low.week - 1)} className="cursor-pointer font-semibold text-primary-700 underline-offset-2 hover:underline">
                  week {low.week}, {weekRange(low.from, low.to)}
                </button>
                .{" "}
                {state === "negative"
                  ? "Cash runs out: payments due that week can't all be met."
                  : state === "low"
                    ? `Below the banks' low-balance threshold of ${compact(data.threshold)}.`
                    : data.threshold > 0
                      ? `Above the low-balance threshold of ${compact(data.threshold)} every week.`
                      : "No low-balance threshold is set on the bank accounts."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {state === "ok" ? (
                  <Chip hue="mint" icon={ShieldCheck}>
                    Clear for thirteen weeks
                  </Chip>
                ) : (
                  <Chip hue="rose" icon={CircleAlert}>
                    {lowWeeks.length === 1 ? "1 week" : `${lowWeeks.length} weeks`} {state === "negative" ? "short of cash" : "below threshold"}
                  </Chip>
                )}
              </div>
            </>
          ) : (
            <p className="mt-2 text-sm text-neutral-600">Nothing to forecast yet.</p>
          )}
        </div>
        <dl className="grid grid-cols-2 gap-3 self-start">
          {(
            [
              ["Cash today", data.opening, "In the bank accounts", "blue"],
              ["After thirteen weeks", last?.closing ?? data.opening, last ? `End of ${dayShort(last.to)}` : "", last && last.closing < data.opening ? "coral" : "mint"],
              ["Coming in", totalIn, "Receipts and pipeline", "mint"],
              ["Going out", totalOut, "Payments, payroll, tax", "coral"],
            ] as const
          ).map(([label, v, hint, hue]) => (
            <div key={label} className="rounded-2xl bg-neutral-50 px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
                <span className={cx("h-1.5 w-1.5 rounded-full", HUE[hue].dot)} aria-hidden />
                {label}
              </dt>
              <dd className="mt-1 text-xl font-bold tabular-nums tracking-tight text-neutral-900">{compact(v)}</dd>
              <dd className="text-[11px] text-neutral-500">{hint}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function OpeningCash({ data }: { data: CashForecast }) {
  const max = Math.max(1, ...data.accounts.map((a) => Math.abs(a.balance)));
  return (
    <Panel title="Cash today by account" subtitle={`${compact(data.opening)} across ${data.accounts.length === 1 ? "1 account" : `${data.accounts.length} accounts`}`} icon={Landmark} hue="blue">
      {data.accounts.length === 0 ? (
        <Empty icon={Landmark} title="No bank accounts" hint="Add the bank accounts in Banking: the forecast starts from their balances." />
      ) : (
        <ul className="space-y-3">
          {data.accounts.map((a) => (
            <li key={a.code}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-neutral-800">
                  <span className="font-mono text-[12px] text-neutral-500">{a.code}</span> {a.name}
                </span>
                <Money value={a.balance} className="shrink-0 font-semibold text-neutral-900" />
              </div>
              <span className="ws-hatch mt-1.5 block h-1.5 overflow-hidden rounded-full" aria-hidden>
                <span className={cx("block h-full rounded-full", a.balance < 0 ? "bg-rose-500" : "bg-primary-500")} style={{ width: `${(Math.abs(a.balance) / max) * 100}%` }} />
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function WhatMoves({ items }: { items: ForecastItem[] }) {
  const totals = kindTotals(items);
  const kinds = KIND_ORDER.filter((k) => totals[k] !== 0);
  const max = Math.max(1, ...kinds.map((k) => Math.abs(totals[k])));
  return (
    <Panel title="What moves the cash" subtitle="Thirteen weeks, by where it comes from" icon={Waves} hue="grape">
      {kinds.length === 0 ? (
        <p className="text-sm text-neutral-500">Nothing is expected in or out yet.</p>
      ) : (
        <ul className="space-y-3">
          {kinds.map((k) => {
            const m = KIND[k];
            const v = totals[k];
            return (
              <li key={k}>
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="flex min-w-0 items-center gap-2 text-neutral-800">
                    <m.icon size={14} className={HUE[m.hue].text} aria-hidden />
                    <span className="truncate">{m.label}</span>
                  </span>
                  <Money value={v} signed className={cx("shrink-0 font-semibold", v > 0 ? "text-mint-700" : "")} />
                </div>
                <span className="ws-hatch mt-1.5 block h-1.5 overflow-hidden rounded-full" aria-hidden>
                  <span className={cx("block h-full rounded-full", HUE[m.hue].bar)} style={{ width: `${(Math.abs(v) / max) * 100}%` }} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */
/*  Week by week, each opening to its items                            */
/* ------------------------------------------------------------------ */

/** The thirteen weeks as a spreadsheet: one row a week, in and out by kind beside the totals. */
export function forecastCsvRows(data: CashForecast): (string | number)[][] {
  return [
    ["Week", "From", "To", "Currency", "Opening", "In", "Out", "Closing", ...KIND_ORDER.map((k) => KIND[k].label), "Flag"],
    ...data.weeks.map((w) => [
      w.week,
      csvDate(w.from),
      csvDate(w.to),
      "NGN",
      csvAmount(w.opening),
      csvAmount(w.inflows),
      csvAmount(w.outflows),
      csvAmount(w.closing),
      ...KIND_ORDER.map((k) => csvAmount(w.byKind[k] ?? 0)),
      w.negative ? "Below zero" : w.low ? "Below threshold" : "",
    ]),
  ];
}

function WeeksTable({ data, open, onToggle }: { data: CashForecast; open: number | null; onToggle: (i: number) => void }) {
  return (
    <section aria-labelledby="cf-weeks">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="cf-weeks" className="text-[15px] font-semibold text-neutral-900">
          Week by week
        </h2>
        <Button size="sm" icon={Download} onClick={() => downloadCsv(`cash-forecast_${data.asOf}.csv`, forecastCsvRows(data))} disabled={data.weeks.length === 0}>
          Download CSV
        </Button>
      </div>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <caption className="sr-only">Opening, in, out and closing cash for each of the thirteen weeks; open a week for its items</caption>
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                <th scope="col" className="py-3 pl-5 pr-2">Week</th>
                <th scope="col" className="px-2 py-3 text-right">Opening</th>
                <th scope="col" className="px-2 py-3 text-right">In</th>
                <th scope="col" className="px-2 py-3 text-right">Out</th>
                <th scope="col" className="px-2 py-3 text-right">Closing</th>
                <th scope="col" className="py-3 pl-2 pr-5">
                  <span className="sr-only">Flag</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.weeks.map((w, i) => {
                const expanded = open === i;
                const groups = itemsByKind(data.items, i);
                return (
                  <Fragment key={w.week}>
                    <tr id={`cf-week-${i}`} className={cx("border-b border-neutral-100", (w.low || w.negative) && "bg-rose-50/60", expanded && "bg-primary-50/50")}>
                      <th scope="row" className="py-2 pl-3 pr-2 text-left font-normal">
                        <button
                          type="button"
                          onClick={() => onToggle(i)}
                          aria-expanded={expanded}
                          aria-controls={`cf-items-${i}`}
                          className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2 text-left outline-none hover:bg-neutral-100/70 focus-visible:ring-2 focus-visible:ring-primary-300"
                        >
                          {expanded ? <ChevronDown size={16} className="shrink-0 text-neutral-500" aria-hidden /> : <ChevronRight size={16} className="shrink-0 text-neutral-500" aria-hidden />}
                          <span>
                            <span className="block font-semibold text-neutral-900">Week {w.week}</span>
                            <span className="sr-only">, </span>
                            <span className="block text-xs text-neutral-500">{weekRange(w.from, w.to)}</span>
                          </span>
                        </button>
                      </th>
                      <td className="px-2 py-2 text-right tabular-nums text-neutral-600">{compact(w.opening)}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-mint-700">{w.inflows ? `+${compact(w.inflows)}` : "–"}</td>
                      <td className="px-2 py-2 text-right tabular-nums text-coral-700">{w.outflows ? `−${compact(w.outflows)}` : "–"}</td>
                      <td className={cx("px-2 py-2 text-right font-semibold tabular-nums", w.negative ? "text-rose-700" : "text-neutral-900")}>{compact(w.closing)}</td>
                      <td className="py-2 pl-2 pr-5">
                        {w.negative ? (
                          <Chip hue="rose" icon={CircleAlert}>
                            Below zero
                          </Chip>
                        ) : w.low ? (
                          <Chip hue="rose" icon={CircleAlert}>
                            Below threshold
                          </Chip>
                        ) : null}
                      </td>
                    </tr>
                    {expanded && (
                      <tr id={`cf-items-${i}`} className="border-b border-neutral-100 bg-neutral-50/50">
                        <td colSpan={6} className="px-5 py-4">
                          {groups.length === 0 ? (
                            <p className="text-sm text-neutral-500">Nothing expected in or out this week.</p>
                          ) : (
                            <div className="grid gap-4 lg:grid-cols-2">
                              {groups.map((g) => {
                                const m = KIND[g.kind];
                                return (
                                  <div key={g.kind} className="rounded-2xl bg-white p-4 ring-1 ring-neutral-200/70">
                                    <div className="mb-2 flex items-center justify-between gap-2">
                                      <Chip hue={m.hue} icon={m.icon}>
                                        {m.label}
                                      </Chip>
                                      <Money value={g.total} signed className={cx("text-sm font-semibold", g.total > 0 && "text-mint-700")} />
                                    </div>
                                    <ul className="divide-y divide-neutral-100">
                                      {g.items.map((it, k) => (
                                        <ItemRow key={`${it.label}-${k}`} item={it} />
                                      ))}
                                    </ul>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </section>
  );
}

function ItemRow({ item }: { item: ForecastItem }) {
  const label = (
    <>
      {item.reference && <span className="font-mono text-[12px] text-neutral-500">{item.reference} </span>}
      {item.label}
    </>
  );
  return (
    <li className="flex items-start justify-between gap-3 py-2 text-sm">
      <span className="min-w-0">
        {item.link ? (
          <Link href={item.link} className="font-medium text-neutral-900 hover:text-primary-700 hover:underline">
            {label}
          </Link>
        ) : (
          <span className="font-medium text-neutral-900">{label}</span>
        )}
        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-neutral-500">
          {day(item.on)}
          {item.late && (
            <Chip hue="sun" icon={Clock} className="!px-2 !py-0.5 text-[11px]">
              Late, counted now
            </Chip>
          )}
        </span>
      </span>
      <Money value={item.direction === "in" ? item.amount : -item.amount} signed className={cx("shrink-0 font-semibold", item.direction === "in" && "text-mint-700")} />
    </li>
  );
}

/* ------------------------------------------------------------------ */
/*  The calendar view                                                  */
/* ------------------------------------------------------------------ */

function ForecastCalendar({ data }: { data: CashForecast }) {
  const span = useMemo(() => {
    const first = data.weeks[0]?.from ?? data.asOf;
    const last = data.weeks[data.weeks.length - 1]?.to ?? data.asOf;
    const [fy, fm] = first.split("-").map(Number);
    const [ly, lm] = last.split("-").map(Number);
    const out: { y: number; m: number }[] = [];
    const months = (ly - fy) * 12 + (lm - fm);
    for (let i = 0; i <= months; i++) {
      const k = fm - 1 + i;
      out.push({ y: fy + Math.floor(k / 12), m: k % 12 });
    }
    return out;
  }, [data]);
  const [at, setAt] = useState(0);
  const cur = span[Math.min(at, span.length - 1)] ?? { y: new Date().getFullYear(), m: new Date().getMonth() };

  const events: CalendarEvent[] = data.items.map((it, i) => ({
    id: `${i}`,
    date: it.on,
    title: `${it.direction === "in" ? "+" : "−"}${compact(it.amount)} ${it.label}`,
    meta: KIND[it.kind].label,
    hue: KIND[it.kind].hue,
    href: it.link ?? undefined,
    allDay: true,
  }));

  return (
    <div>
      <CalendarNav title={monthTitle(cur.y, cur.m)} onPrev={() => setAt((a) => Math.max(0, a - 1))} onNext={() => setAt((a) => Math.min(span.length - 1, a + 1))} onToday={() => setAt(0)} />
      <MonthCalendar year={cur.y} month={cur.m} events={events} maxPerDay={3} />
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-600" aria-label="Kinds">
        {KIND_ORDER.map((k) => (
          <li key={k} className="flex items-center gap-1.5">
            <span className={cx("h-2 w-2 rounded-full", HUE[KIND[k].hue].dot)} aria-hidden />
            {KIND[k].label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SourcesPanel() {
  return (
    <Panel title="Where the figures come from" subtitle="Everything but the recurring items and the two percentages is from the books" icon={CircleAlert} hue="slate">
      <ul className="space-y-2.5">
        {KIND_ORDER.map((k) => {
          const m = KIND[k];
          return (
            <li key={k} className="flex gap-2.5 text-sm">
              <m.icon size={15} className={cx("mt-0.5 shrink-0", HUE[m.hue].text)} aria-hidden />
              <span>
                <span className="font-medium text-neutral-900">{m.label}.</span> <span className="text-neutral-600">{m.from}.</span>
              </span>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

