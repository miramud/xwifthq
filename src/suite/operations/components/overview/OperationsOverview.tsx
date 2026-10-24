"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlarmClock,
  BarChart3,
  Boxes,
  CalendarRange,
  CircleCheck,
  ClipboardCheck,
  FilePen,
  FileWarning,
  Gavel,
  HandCoins,
  Headset,
  Hourglass,
  Info,
  Plus,
  Scale,
  ScrollText,
  ShieldAlert,
  Store,
  Truck,
  Workflow,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  CalloutStrip,
  Chip,
  Empty,
  PageHeader,
  Panel,
  QuickActions,
  Segmented,
  StatGrid,
  ViewAllLink,
  WelcomeBanner,
  bannerButtonClass,
  cx,
  type QuickAction,
} from "@/components/workspace/kit";
import { Donut, StackedColumns } from "@/components/workspace/charts";
import { AgendaList, CalendarNav, MonthCalendar, monthTitle, todayYmd, type CalendarEvent } from "@/components/workspace/Calendar";
import { addDays } from "@/components/workspace/calendar-lanes";
import type { Hue } from "@/components/workspace/modules";
import { IconTile, ListRow, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day, monthLabel } from "@/suite/finance/lib/format";
import { useAuth, type AuthUser } from "@/lib/auth-store";
import { opsError, procurement, type Overview } from "@/lib/api/operations-procurement-client";
import { mayUseOperations } from "@/suite/operations/lib/operations-access";
import { OPERATIONS_NAV } from "@/suite/operations/components/nav";
import OverviewTiles, { overviewShows } from "./OverviewTiles";

/** The tint each desk's quick link wears. */
const DESK_HUE: Record<string, Hue> = {
  "/suite/operations/procurement/requests": "blue",
  "/suite/operations/procurement/orders": "sky",
  "/suite/operations/procurement/receiving": "mint",
  "/suite/operations/travel": "sky",
  "/suite/operations/travel/policy": "slate",
  "/suite/operations/events": "grape",
  "/suite/operations/assets": "sky",
  "/suite/operations/assets/requests": "sun",
  "/suite/operations/assets/verification": "grape",
  "/suite/operations/assets/exit-clearances": "coral",
  "/suite/operations/stores": "grape",
  "/suite/operations/stores/requisitions": "sun",
  "/suite/operations/stores/counts": "mint",
  "/suite/operations/desk": "sky",
  "/suite/operations/maintenance": "coral",
  "/suite/operations/facilities": "grape",
  "/suite/operations/fleet": "sun",
  "/suite/operations/compliance": "mint",
  "/suite/operations/correspondence": "rose",
  "/suite/operations/documents": "blue",
  "/suite/operations/documents/controlled": "grape",
  "/suite/operations/clients/requests": "mint",
};

/**
 * The desks this person may open, as quick links: the sidebar's own entries
 * outside "General", under the sidebar's own gates.
 */
function deskLinks(user: AuthUser | null): QuickAction[] {
  return OPERATIONS_NAV.filter((g) => g.heading !== "General")
    .flatMap((g) => g.items)
    .filter((it) => (it.show ? it.show(user) : true))
    .map((it) => ({ label: it.label, href: it.href, icon: it.icon, hue: DESK_HUE[it.href] ?? "blue" }));
}

interface Attention {
  key: string;
  icon: LucideIcon;
  hue: Hue;
  title: string;
  meta: string;
  href?: string;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * What needs someone today, across every desk this person holds: only the
 * figures above zero, each linking to its desk when they may open it.
 */
function attentionItems(data: Overview, user: AuthUser | null): Attention[] {
  const p = data.procurement;
  const show = overviewShows(data, user);
  const items: (Attention | false)[] = [
    p.overdueDeliveries > 0 && {
      key: "deliveries",
      icon: Truck,
      hue: "rose",
      title: `${plural(p.overdueDeliveries, "delivery", "deliveries")} past due`,
      meta: "Receiving",
      href: "/suite/operations/procurement/receiving",
    },
    p.invoiceExceptions > 0 && {
      key: "invoices",
      icon: FileWarning,
      hue: "rose",
      title: `${plural(p.invoiceExceptions, "invoice", "invoices")} not matching`,
      meta: "Not paid until resolved",
      href: "/suite/operations/procurement/receiving",
    },
    p.grnsToApprove > 0 && {
      key: "grns",
      icon: ClipboardCheck,
      hue: "sun",
      title: `${p.grnsToApprove} GRNs and SCCs to approve`,
      meta: "Waiting for a second person",
      href: "/suite/operations/procurement/receiving",
    },
    show.compliance && !!data.compliance && data.compliance.overdue > 0 && {
      key: "compliance-overdue",
      icon: ShieldAlert,
      hue: "rose",
      title: `${plural(data.compliance.overdue, "compliance item", "compliance items")} overdue`,
      meta: "Compliance",
      href: "/suite/operations/compliance",
    },
    show.compliance && !!data.compliance && data.compliance.expired > 0 && {
      key: "compliance-expired",
      icon: ShieldAlert,
      hue: "coral",
      title: `${plural(data.compliance.expired, "certificate", "certificates")} expired`,
      meta: "Compliance",
      href: "/suite/operations/compliance",
    },
    show.maintenance && !!data.maintenance && data.maintenance.slaBreached > 0 && {
      key: "maintenance-sla",
      icon: Wrench,
      hue: "rose",
      title: `${plural(data.maintenance.slaBreached, "work order", "work orders")} past the SLA`,
      meta: "Maintenance",
      href: "/suite/operations/maintenance",
    },
    show.desk && !!data.desk && data.desk.breached > 0 && {
      key: "desk-sla",
      icon: Headset,
      hue: "rose",
      title: `${plural(data.desk.breached, "ticket", "tickets")} past the SLA`,
      meta: "Service desk tickets",
      href: "/suite/operations/desk",
    },
    show.stock && !!data.stock && data.stock.belowReorder > 0 && {
      key: "stock",
      icon: Store,
      hue: "sun",
      title: `${plural(data.stock.belowReorder, "item", "items")} below reorder level`,
      meta: "Stores",
      href: "/suite/operations/stores",
    },
    show.assets && !!data.assets && data.assets.overduePasses > 0 && {
      key: "passes",
      icon: Boxes,
      hue: "coral",
      title: `${plural(data.assets.overduePasses, "gate pass", "gate passes")} overdue`,
      meta: "Taken out, not back",
      href: "/suite/operations/assets/requests",
    },
    show.facilities && !!data.facilities && data.facilities.vehiclePapersExpiring > 0 && {
      key: "papers",
      icon: ShieldAlert,
      hue: "sun",
      title: `${plural(data.facilities.vehiclePapersExpiring, "vehicle", "vehicles")} with papers expiring`,
      meta: "In the next 30 days",
      href: mayUseOperations(user, "fleet") ? "/suite/operations/fleet" : undefined,
    },
    data.clientPayments.totals.overdueFollowUps > 0 && {
      key: "follow-ups",
      icon: AlarmClock,
      hue: "rose",
      title: `${plural(data.clientPayments.totals.overdueFollowUps, "client follow-up", "client follow-ups")} overdue`,
      meta: "Client payments",
      href: mayUseOperations(user, "client_payments") ? "/suite/operations/clients/requests" : undefined,
    },
  ];
  return items.filter((x): x is Attention => Boolean(x));
}

/**
 * The Operations overview: a greeting with what is committed on open
 * orders, the procurement figures, a quick link to every desk this person
 * holds, then what needs attention, what was ordered month by month, the
 * trips and events coming up, the client payments to chase, and the
 * compliance, maintenance, facilities, desk, asset, stock, vendor and travel
 * panels for whoever holds those desks.
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
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the overview…</p>
        <Skeleton className="h-52 rounded-[1.5rem]" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <Skeleton key={i} className="h-[112px]" />
          ))}
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <Skeleton className="h-[320px] xl:col-span-2" />
          <Skeleton className="h-[320px]" />
        </div>
      </div>
    );

  const p = data.procurement;
  const ordered = p.orderedByMonth.map((m) => ({ label: monthLabel(m.month, true).split(" ")[0], values: { goods: m.goods, services: m.services } }));
  const orderedTotal = p.orderedByMonth.reduce((s, m) => s + m.goods + m.services, 0);
  const pipeline = [
    { label: "Requests in approval", value: p.requestsInApproval, hue: "grape" as Hue },
    { label: "To source", value: p.toSource, hue: "sky" as Hue },
    { label: "Awards pending", value: p.awardsPending, hue: "sun" as Hue },
    { label: "Draft orders", value: p.ordersDraft, hue: "slate" as Hue },
    { label: "Open orders", value: p.ordersOpen, hue: "blue" as Hue },
    { label: "GRNs and SCCs to approve", value: p.grnsToApprove, hue: "mint" as Hue },
  ];
  const pipelineTotal = pipeline.reduce((s, x) => s + x.value, 0);
  const today = todayYmd();
  const cp = data.clientPayments;
  const desks = deskLinks(user);
  const attention = attentionItems(data, user);

  return (
    <div>
      <WelcomeBanner
        name={user?.name}
        eyebrow="Operations"
        subtitle="What is waiting where: purchasing, deliveries, trips, events, money clients owe, compliance, assets and stock."
        figure={{
          label: "Committed on open orders",
          value: compact(p.openValue),
          hint: `${plural(p.ordersOpen, "open order", "open orders")} · ${plural(p.requestsInApproval, "request", "requests")} with the approvers`,
        }}
        art="operations"
        actions={
          <Link href="/suite/operations/my/requests/new" className={bannerButtonClass("solid")}>
            <Plus size={17} aria-hidden />
            New purchase request
          </Link>
        }
      />

      <div className="space-y-6">
        {!data.financeOn && (
          <CalloutStrip icon={Info} hue="sky" title="Finance isn't switched on">
            Project funds aren&apos;t checked, and vendor payments wait for Finance.
          </CalloutStrip>
        )}

        <StatGrid>
          <StatCard featured label="To source" value={p.toSource} icon={Scale} href="/suite/operations/procurement/requests" hint={p.toSource ? "Approved requests that need quotations" : "Nothing waiting"} />
          <StatCard label="Requests in approval" value={p.requestsInApproval} icon={Hourglass} hue="grape" href="/suite/operations/procurement/requests?tab=approval" hint="With the approvers" />
          <StatCard label="Awards pending" value={p.awardsPending} icon={Gavel} hue="sun" href="/suite/operations/procurement/requests?tab=award" hint="Recommended, waiting for approval" />
          <StatCard label="Open orders" value={p.ordersOpen} icon={ScrollText} hue="sky" href="/suite/operations/procurement/orders" hint={`${compact(p.openValue)} committed`} />
          <StatCard label="Overdue deliveries" value={p.overdueDeliveries} icon={Truck} hue={p.overdueDeliveries ? "rose" : "mint"} href="/suite/operations/procurement/receiving" hint={p.overdueDeliveries ? "Past their delivery date" : "Nothing late"} />
          <StatCard label="GRNs and SCCs to approve" value={p.grnsToApprove} icon={ClipboardCheck} hue={p.grnsToApprove ? "sun" : "mint"} href="/suite/operations/procurement/receiving" hint="Recorded, waiting for a second person" />
          <StatCard label="Invoice exceptions" value={p.invoiceExceptions} icon={FileWarning} hue={p.invoiceExceptions ? "rose" : "mint"} href="/suite/operations/procurement/receiving" hint={p.invoiceExceptions ? "Not paid until resolved" : "Every invoice matched"} />
          <StatCard label="Draft orders" value={p.ordersDraft} icon={FilePen} hue="slate" href="/suite/operations/procurement/orders?tab=draft" hint="Set the terms, then send for approval" />
        </StatGrid>

        <QuickActions title="Your desks" items={desks} />

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel
            className="xl:col-span-2"
            title="Ordered by month"
            subtitle={`Approved orders, goods and services · ${compact(orderedTotal)} in ${p.orderedByMonth.length} months`}
            icon={BarChart3}
            hue="blue"
            actions={mayUseOperations(user, "purchase_orders") ? <ViewAllLink href="/suite/operations/procurement/orders" /> : undefined}
          >
            {orderedTotal === 0 ? (
              <div className="ws-hatch rounded-2xl px-5 py-12 text-center">
                <p className="text-sm font-semibold text-neutral-800">Nothing ordered in these months yet</p>
                <p className="mt-1 text-sm text-neutral-600">Approved purchase orders show here under the month they were approved.</p>
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

          <Panel title="Needs attention" subtitle="Across the desks you hold" icon={ShieldAlert} hue="rose" bodyClassName="px-3 pb-4 pt-3">
            {attention.length === 0 ? (
              <CalloutStrip icon={CircleCheck} hue="mint" title="You're all caught up" className="mx-2">
                Nothing late, breached or below its level right now.
              </CalloutStrip>
            ) : (
              <ul>
                {attention.map((a) => (
                  <ListRow key={a.key} leading={<IconTile icon={a.icon} hue={a.hue} />} title={a.title} meta={a.meta} href={a.href} />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
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
            <div className="mt-4 flex flex-wrap gap-2">
              <Chip hue="sky" dot>
                Trips
              </Chip>
              <Chip hue="grape" dot>
                Events
              </Chip>
            </div>
          </Panel>

          <div className="space-y-6">
            <Panel title="Procurement pipeline" subtitle="Where purchases are right now" icon={Workflow} hue="grape">
              <Donut data={pipeline} total={pipelineTotal} centerLabel="in the pipeline" caption="Purchases by stage" size={150} legend="below" />
            </Panel>

            <Panel
              title="Client payments to chase"
              subtitle={`${cp.totals.open} open · ${compact(cp.totals.value)} owed`}
              icon={HandCoins}
              hue="mint"
              bodyClassName="px-3 pb-4 pt-3"
              actions={mayUseOperations(user, "client_payments") ? <ViewAllLink href="/suite/operations/clients/requests" /> : undefined}
            >
              {cp.followUps.length === 0 ? (
                <Empty icon={HandCoins} hue="mint" title="No follow-ups scheduled" hint="Open client payment requests with a next follow-up date show here." />
              ) : (
                <ul>
                  {cp.followUps.map((f) => (
                    <ListRow
                      key={f.id}
                      href={`/suite/operations/clients/requests/${f.id}`}
                      leading={
                        <span
                          className={cx(
                            "flex h-11 w-11 flex-col items-center justify-center rounded-xl text-center",
                            f.followUpOverdue ? "bg-rose-50 text-rose-700" : "bg-mint-50 text-mint-700",
                          )}
                          aria-hidden
                        >
                          <AlarmClock size={12} />
                          <span className="text-[11px] font-bold leading-tight tabular-nums">{f.nextFollowUpOn ? day(f.nextFollowUpOn).split(" ").slice(0, 2).join(" ") : "-"}</span>
                        </span>
                      }
                      title={f.client ?? f.title}
                      meta={
                        <>
                          {f.stageLabel}
                          {f.accountManager ? ` · ${f.accountManager}` : ""}
                          <span className="sr-only">Next follow-up {day(f.nextFollowUpOn)}</span>
                        </>
                      }
                      trailing={
                        <span className="flex flex-col items-end gap-1">
                          <Money value={f.amount} currency={f.currency} className="text-xs font-semibold text-neutral-800" />
                          {f.followUpOverdue && (
                            <Chip hue="rose" className="!px-2 !py-0.5 !text-[10px]">
                              Follow-up overdue
                            </Chip>
                          )}
                        </span>
                      }
                    />
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>

        <OverviewTiles data={data} user={user} />
      </div>
    </div>
  );
}
