"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  ArrowRight,
  BarChart3,
  CalendarRange,
  ClipboardCheck,
  FilePen,
  FileWarning,
  Gavel,
  HandCoins,
  Hourglass,
  Info,
  Plus,
  Scale,
  ScrollText,
  Truck,
  Workflow,
} from "lucide-react";
import { ButtonLink, Chip, PageHeader, Panel, Segmented, StatGrid, cx } from "@/components/workspace/kit";
import { StackedColumns, StatusBars } from "@/components/workspace/charts";
import { AgendaList, CalendarNav, MonthCalendar, monthTitle, todayYmd, type CalendarEvent } from "@/components/workspace/Calendar";
import { addDays } from "@/components/workspace/calendar-lanes";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day, monthLabel } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { opsError, procurement, type Overview } from "@/lib/api/operations-procurement-client";
import { mayUseOperations } from "@/suite/operations/lib/operations-access";
import OverviewTiles from "./OverviewTiles";

/**
 * The Operations overview: what is waiting where. Procurement's desks as
 * tiles that open them, what was ordered month by month, the trips and
 * events coming up on a calendar, the client payments to chase next; then
 * compliance, assets, stock, vendors and travel change fees for whoever
 * holds those desks.
 */
export default function OperationsOverview() {
  const { user } = useAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [when, setWhen] = useState<"agenda" | "month">("agenda");
  const now = new Date();
  const [month, setMonth] = useState({ y: now.getFullYear(), m: now.getMonth() });

  /* No overview key (most staff): their Operations is their own requests, as in Finance. */
  const router = useRouter();
  const mayView = Boolean(user) && mayUseOperations(user, "overview");
  useEffect(() => {
    if (user && !mayView) router.replace("/suite/operations/my/requests");
  }, [user, mayView, router]);

  useEffect(() => {
    if (!mayView) return;
    let alive = true;
    procurement.overview().then(
      (d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`The overview didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload, mayView]);

  const events: CalendarEvent[] = useMemo(() => {
    if (!data) return [];
    const trips: CalendarEvent[] = data.travel.upcoming
      .filter((t) => t.departsOn)
      .map((t) => ({
        id: `trip-${t.id}`,
        date: t.departsOn as string,
        endDate: t.returnsOn ?? undefined,
        title: `${t.destination}: ${t.purpose}`,
        meta: `${t.travellers} ${t.travellers === 1 ? "traveller" : "travellers"}${t.status === "booked" ? " · booked" : ""}`,
        hue: "sky",
        kind: "trip",
        allDay: true,
        href: `/suite/operations/travel/${t.id}`,
      }));
    const evs: CalendarEvent[] = data.events
      .filter((e) => e.startsOn)
      .map((e) => ({
        id: `event-${e.id}`,
        date: e.startsOn as string,
        endDate: e.endsOn ?? undefined,
        title: e.name,
        meta: `${e.typeLabel}${e.location ? ` · ${e.location}` : ""}${e.status === "in_approval" ? " · in approval" : ""}`,
        hue: "grape",
        kind: "event",
        allDay: true,
        href: `/suite/operations/events/${e.id}`,
      }));
    return [...trips, ...evs];
  }, [data]);

  if (error && !data)
    return (
      <div>
        <PageHeader title="Operations" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );

  if (!data)
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the overview…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <div className="grid gap-5 xl:grid-cols-3">
          <Skeleton className="h-[320px] xl:col-span-2" />
          <Skeleton className="h-[320px]" />
        </div>
      </div>
    );

  const p = data.procurement;
  const ordered = p.orderedByMonth.map((m) => ({ label: monthLabel(m.month, true).split(" ")[0], values: { goods: m.goods, services: m.services } }));
  const orderedTotal = p.orderedByMonth.reduce((s, m) => s + m.goods + m.services, 0);
  const today = todayYmd();
  const cp = data.clientPayments;

  return (
    <div>
      <PageHeader
        title="Operations"
        subtitle="What is waiting where: purchasing, deliveries, trips, events, the money clients owe, compliance, assets and stock."
        actions={
          <ButtonLink href="/suite/operations/my/requests/new" variant="primary" icon={Plus}>
            New purchase request
          </ButtonLink>
        }
      />

      {!data.financeOn && (
        <p className="mb-5 flex items-start gap-2 rounded-xl bg-sky-50 px-4 py-3 text-sm text-sky-700 ring-1 ring-sky-500/20">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          Finance isn&apos;t switched on, so project funds aren&apos;t checked and vendor payments wait for Finance.
        </p>
      )}

      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="To source" value={p.toSource} icon={Scale} href="/suite/operations/procurement/requests" hint={p.toSource ? "Approved requests to get quotations for" : "Nothing waiting"} />
          <StatCard label="Requests in approval" value={p.requestsInApproval} icon={Hourglass} hue="grape" href="/suite/operations/procurement/requests?tab=approval" hint="With the approvers" />
          <StatCard label="Awards pending" value={p.awardsPending} icon={Gavel} hue="sun" href="/suite/operations/procurement/requests?tab=award" hint="Recommended, waiting on approval" />
          <StatCard label="Open orders" value={p.ordersOpen} icon={ScrollText} hue="sky" href="/suite/operations/procurement/orders" hint={`${compact(p.openValue)} committed`} />
        </StatGrid>
        <StatGrid>
          <StatCard label="Overdue deliveries" value={p.overdueDeliveries} icon={Truck} hue={p.overdueDeliveries ? "rose" : "mint"} href="/suite/operations/procurement/receiving" hint={p.overdueDeliveries ? "Past their delivery date" : "Nothing late"} />
          <StatCard label="GRNs and SCCs to approve" value={p.grnsToApprove} icon={ClipboardCheck} hue={p.grnsToApprove ? "sun" : "mint"} href="/suite/operations/procurement/receiving" hint="Recorded, waiting for a second person" />
          <StatCard label="Invoice exceptions" value={p.invoiceExceptions} icon={FileWarning} hue={p.invoiceExceptions ? "rose" : "mint"} href="/suite/operations/procurement/receiving" hint={p.invoiceExceptions ? "Not paid until resolved" : "Every invoice matched"} />
          <StatCard label="Draft orders" value={p.ordersDraft} icon={FilePen} hue="slate" href="/suite/operations/procurement/orders?tab=draft" hint="Terms to set, then approval" />
        </StatGrid>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Ordered by month"
            subtitle={`Approved orders, goods and services · ${compact(orderedTotal)} in ${p.orderedByMonth.length} months`}
            icon={BarChart3}
            hue="blue"
          >
            {orderedTotal === 0 ? (
              <div className="ws-hatch rounded-2xl px-5 py-12 text-center">
                <p className="text-sm font-semibold text-neutral-800">Nothing ordered in these months yet</p>
                <p className="mt-1 text-sm text-neutral-600">Approved purchase orders show here by the month they were approved.</p>
              </div>
            ) : (
              <StackedColumns
                data={ordered}
                series={[
                  { key: "goods", label: "Goods (LPO)", hue: "sky" },
                  { key: "services", label: "Services (LSO)", hue: "grape" },
                ]}
                format={(v) => compact(v)}
                caption="Value of approved orders by month, goods and services"
                height={240}
                showTotals
              />
            )}
          </Panel>

          <Panel title="Procurement pipeline" subtitle="Where purchases are right now" icon={Workflow} hue="grape">
            <StatusBars
              data={[
                { label: "Requests in approval", value: p.requestsInApproval, hue: "grape" },
                { label: "To source", value: p.toSource, hue: "sky" },
                { label: "Awards pending", value: p.awardsPending, hue: "sun" },
                { label: "Draft orders", value: p.ordersDraft, hue: "slate" },
                { label: "Open orders", value: p.ordersOpen, hue: "blue" },
                { label: "Notes to approve", value: p.grnsToApprove, hue: "mint" },
              ]}
              caption="Purchases by stage"
            />
          </Panel>
        </div>

        <div className="grid gap-5 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Trips and events"
            subtitle={`${data.travel.upcoming.length} upcoming ${data.travel.upcoming.length === 1 ? "trip" : "trips"} · ${data.events.length} ${data.events.length === 1 ? "event" : "events"}${data.travel.inApproval ? ` · ${data.travel.inApproval} trip in approval` : ""}`}
            icon={CalendarRange}
            hue="sky"
            actions={
              <Segmented
                label="Show as"
                value={when}
                onChange={setWhen}
                options={[
                  { key: "agenda", label: "Agenda" },
                  { key: "month", label: "Month" },
                ]}
              />
            }
          >
            {when === "agenda" ? (
              <AgendaList events={events} from={today} to={addDays(today, 90)} emptyLabel="No trips or events in the next three months." statusChips={false} />
            ) : (
              <>
                <CalendarNav
                  title={monthTitle(month.y, month.m)}
                  onPrev={() => setMonth(({ y, m }) => (m === 0 ? { y: y - 1, m: 11 } : { y, m: m - 1 }))}
                  onNext={() => setMonth(({ y, m }) => (m === 11 ? { y: y + 1, m: 0 } : { y, m: m + 1 }))}
                  onToday={() => setMonth({ y: now.getFullYear(), m: now.getMonth() })}
                />
                <MonthCalendar year={month.y} month={month.m} events={events} spanning />
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-neutral-600">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-sky-500" aria-hidden />
                Trips
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-grape-500" aria-hidden />
                Events
              </span>
            </div>
          </Panel>

          <Panel title="Client payments to chase" subtitle={`${cp.totals.open} open · ${compact(cp.totals.value)} owed`} icon={HandCoins} hue="mint">
            {cp.followUps.length === 0 ? (
              <p className="text-sm text-neutral-500">No follow-ups scheduled. Open client payment requests with a next follow-up date appear here.</p>
            ) : (
              <ul className="space-y-2">
                {cp.followUps.map((f) => (
                  <li key={f.id}>
                    <Link
                      href={`/suite/operations/clients/requests/${f.id}`}
                      className="group flex items-start gap-3 rounded-xl border border-neutral-200 px-3 py-2.5 outline-none transition hover:border-primary-300 hover:bg-primary-50/30 focus-visible:ring-2 focus-visible:ring-primary-300"
                    >
                      <span
                        className={cx(
                          "flex w-11 shrink-0 flex-col items-center rounded-lg py-1 text-center",
                          f.followUpOverdue ? "bg-rose-50 text-rose-700" : "bg-neutral-50 text-neutral-800",
                        )}
                        aria-hidden
                      >
                        <AlarmClock size={12} />
                        <span className="text-[11px] font-bold tabular-nums">{f.nextFollowUpOn ? day(f.nextFollowUpOn).split(" ").slice(0, 2).join(" ") : "—"}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-900">{f.client ?? f.title}</span>
                        <span className="block truncate text-xs text-neutral-500">
                          {f.stageLabel}
                          {f.accountManager ? ` · ${f.accountManager}` : ""}
                        </span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5">
                          <Money value={f.amount} currency={f.currency} className="text-xs font-semibold text-neutral-800" />
                          {f.followUpOverdue && (
                            <Chip hue="rose" className="!px-2 !py-0.5 !text-[10px]">
                              Follow-up overdue
                            </Chip>
                          )}
                          <span className="sr-only">Next follow-up {day(f.nextFollowUpOn)}</span>
                        </span>
                      </span>
                      <ArrowRight size={15} className="mt-1 shrink-0 text-neutral-400 group-hover:text-primary-600" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <OverviewTiles data={data} user={user} />
      </div>
    </div>
  );
}
