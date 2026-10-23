"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, ClipboardCheck, Hourglass, Tent, Users, Wallet } from "lucide-react";
import { Card, Empty, PageHeader, Panel, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { todayYmd } from "@/components/workspace/Calendar";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact } from "@/suite/finance/lib/format";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { events, opsError, type EventSummary } from "@/lib/api/operations-travel-client";
import { EVENT_STATUS, dateSpan, eventStatus } from "../travel/labels";
import { MetaChip } from "../travel/shared";
import SpanCalendar from "../travel/SpanCalendar";
import EventCard from "./EventCard";

/** Every event past draft, on a calendar and as a list, with its budget dashboard one click away. */

type Tab = "all" | "in_approval" | "approved" | "closed";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_approval", label: "In approval" },
  { key: "approved", label: "Running" },
  { key: "closed", label: "Closed" },
];

const inTab = (e: EventSummary, t: Tab) => (t === "all" ? true : t === "closed" ? ["closed", "rejected", "cancelled"].includes(e.status) : e.status === t);

/** The events as listed, for a spreadsheet. Exported for testing. */
export function eventRows(rows: EventSummary[]) {
  return [
    ["Number", "Event", "Type", "Starts", "Ends", "Location", "Project", "Lead", "Status", "Staff attending", "Guests", "Attendance", "Budget", "Currency", "Closed"],
    ...rows.map((e) => [
      e.number ?? "",
      e.name,
      e.typeLabel,
      csvDate(e.startsOn),
      csvDate(e.endsOn),
      e.location ?? "",
      e.project?.name ?? "Cost centre",
      e.lead ?? "",
      eventStatus(e.status).label,
      e.participantsInternal,
      e.participantsExternal,
      e.attendance ?? "",
      csvAmount(e.budget),
      "NGN",
      csvDate(e.closedAt),
    ]),
  ];
}

export default function EventsDesk() {
  const [rows, setRows] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("all");
  const listView = useListView("ops-events-desk");
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    events.desk.list().then(
      (r) => {
        if (!alive) return;
        setRows(r.events);
        setError(null);
      },
      (e: unknown) => alive && setError(`The events didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const stats = useMemo(
    () => ({
      running: all.filter((e) => e.status === "approved"),
      waiting: all.filter((e) => e.status === "in_approval").length,
      toClose: all.filter((e) => e.status === "approved" && e.endsOn < today).length,
      people: all.filter((e) => e.status === "approved" && e.endsOn >= today).reduce((s, e) => s + e.participantsInternal + e.participantsExternal, 0),
    }),
    [all, today],
  );
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((x) => inTab(x, t.key)).length])) as Record<Tab, number>;

  const items = all
    .filter((e) => e.status !== "rejected" && e.status !== "cancelled")
    .map((e) => ({ id: e.id, from: e.startsOn, to: e.endsOn, title: e.name, meta: e.location ?? undefined, hue: eventStatus(e.status).hue, href: `/suite/operations/events/${e.id}` }));
  const legend = (["in_approval", "approved", "closed"] as const).filter((s) => all.some((e) => e.status === s)).map((s) => ({ label: EVENT_STATUS[s].label, hue: EVENT_STATUS[s].hue }));

  const columns: Column<EventSummary>[] = [
    {
      key: "name",
      header: "Event",
      primary: true,
      sortable: true,
      value: (e) => `${e.name} ${e.number ?? ""} ${e.lead ?? ""}`,
      render: (e) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{e.name}</span>
          <span className="block truncate text-xs text-neutral-500">
            {e.number} · {e.lead}
          </span>
        </span>
      ),
    },
    { key: "dates", header: "Dates", sortable: true, value: (e) => e.startsOn, render: (e) => <span className="tabular-nums">{dateSpan(e.startsOn, e.endsOn)}</span> },
    { key: "project", header: "Project", sortable: true, hideOnMobile: true, value: (e) => e.project?.name ?? "Cost centre" },
    { key: "status", header: "Status", sortable: true, value: (e) => eventStatus(e.status).label, render: (e) => <MetaChip meta={eventStatus(e.status)} /> },
    { key: "budget", header: "Budget", align: "right", sortable: true, value: (e) => e.budget, render: (e) => <Money value={e.budget} className="font-semibold" /> },
  ];

  if (error && rows === null) return <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />;

  if (rows === null) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading events…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[560px]" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Events"
        subtitle="Every workshop, training and meeting with an approved or pending budget."
        tabs={all.length > 0 ? TABS.map((t) => ({ ...t, count: counts[t.key] })) : undefined}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {all.length === 0 ? (
        <Card>
          <Empty icon={Tent} title="No events yet" hint="Events show here once their lead sends the budget for approval. Anyone plans one from My events." />
        </Card>
      ) : (
        <div className="space-y-5">
          <StatGrid>
            <StatCard featured label="Running" value={stats.running.length} icon={CalendarRange} hint={`${compact(stats.running.reduce((s, e) => s + e.budget, 0))} approved`} />
            <StatCard label="In approval" value={stats.waiting} icon={Hourglass} hue="grape" />
            <StatCard label="Over, to close out" value={stats.toClose} icon={ClipboardCheck} hue={stats.toClose ? "coral" : "slate"} />
            <StatCard label="People at upcoming events" value={stats.people} icon={Users} hue="sky" />
          </StatGrid>

          <Panel title="Events calendar" icon={CalendarRange} hue="sky">
            <SpanCalendar items={items} legend={legend} label="Events by month" emptyLabel="No events this month." />
          </Panel>

          <DataView
            rows={all.filter((e) => inTab(e, tab))}
            columns={columns}
            rowKey={(e) => e.id}
            rowHref={(e) => `/suite/operations/events/${e.id}`}
            {...listView}
            searchPlaceholder="Search events, leads or numbers"
            caption="Events"
            gridCols={3}
            onDownload={(r) => downloadCsv(`events${tab === "all" ? "" : `_${tab}`}.csv`, eventRows(r))}
            renderCard={(e) => <EventCard event={e} />}
            renderListItem={(e) => <EventCard event={e} flat />}
            empty={<p className="px-5 py-10 text-center text-sm text-neutral-500">No events here. Try another tab.</p>}
          />
          <p className="flex items-center gap-1.5 text-xs text-neutral-500">
            <Wallet size={13} aria-hidden />
            Budgets are the approved totals; open an event for committed and paid by line.
          </p>
        </div>
      )}
    </div>
  );
}
