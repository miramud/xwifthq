"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, ClipboardCheck, FilePen, Plus, Tent, Wallet } from "lucide-react";
import { ButtonLink, Card, Empty, PageHeader, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { todayYmd } from "@/components/workspace/Calendar";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact } from "@/suite/finance/lib/format";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { events, opsError, type EventSummary } from "@/lib/api/operations-travel-client";
import { dateSpan, eventStatus } from "../travel/labels";
import { MetaChip } from "../travel/shared";
import EventCard from "../events/EventCard";

/** Events I lead or created: drafts to finish, approved ones to run, and those to close out. */

type Tab = "all" | "drafts" | "running" | "closed";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "drafts", label: "Drafts" },
  { key: "running", label: "In approval or running" },
  { key: "closed", label: "Closed" },
];

function inTab(e: EventSummary, tab: Tab): boolean {
  if (tab === "drafts") return e.status === "draft";
  if (tab === "running") return e.status === "in_approval" || e.status === "approved";
  if (tab === "closed") return ["closed", "rejected", "cancelled"].includes(e.status);
  return true;
}

export default function MyEventsBoard() {
  const [rows, setRows] = useState<EventSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("all");
  const listView = useListView("ops-my-events");
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    events.me.list().then(
      (r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Your events didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const stats = useMemo(() => {
    const next = all.filter((e) => e.status === "approved" && e.endsOn >= today).sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] ?? null;
    const toClose = all.filter((e) => e.status === "approved" && e.endsOn < today).length;
    const budget = all.filter((e) => e.status === "approved" || e.status === "in_approval").reduce((s, e) => s + e.budget, 0);
    return { next, toClose, budget, drafts: all.filter((e) => e.status === "draft").length };
  }, [all, today]);

  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((x) => inTab(x, t.key)).length])) as Record<Tab, number>;
  const shown = all.filter((e) => inTab(e, tab));

  const columns: Column<EventSummary>[] = [
    {
      key: "name",
      header: "Event",
      primary: true,
      sortable: true,
      value: (e) => `${e.name} ${e.number ?? ""}`,
      render: (e) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{e.name}</span>
          <span className="block truncate text-xs text-neutral-500">
            {e.number ?? "Draft"} · {e.typeLabel}
          </span>
        </span>
      ),
    },
    { key: "dates", header: "Dates", sortable: true, value: (e) => e.startsOn, render: (e) => <span className="tabular-nums">{dateSpan(e.startsOn, e.endsOn)}</span> },
    { key: "status", header: "Status", sortable: true, value: (e) => eventStatus(e.status).label, render: (e) => <MetaChip meta={eventStatus(e.status)} /> },
    { key: "budget", header: "Budget", align: "right", sortable: true, value: (e) => e.budget, render: (e) => <Money value={e.budget} className="font-semibold" /> },
  ];

  return (
    <div>
      <PageHeader
        title="My events"
        subtitle="Workshops, trainings and meetings you lead: one approved budget, every line paid through its own channel."
        actions={
          <ButtonLink href="/suite/operations/my/events/new" variant="primary" icon={Plus}>
            Plan an event
          </ButtonLink>
        }
        tabs={rows && rows.length > 0 ? TABS.map((t) => ({ ...t, count: counts[t.key] })) : undefined}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {error && rows === null && <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />}

      {rows === null && !error && (
        <div aria-busy="true" className="space-y-5">
          <p className="sr-only">Loading your events…</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-[132px]" />
            ))}
          </div>
          <Skeleton className="h-[320px]" />
        </div>
      )}

      {rows !== null && rows.length === 0 && (
        <Card>
          <Empty
            icon={Tent}
            title="Plan your first event"
            hint="Set the dates, who is coming and the budget line by line. Once approved, raise the purchase requests, trips and advance each line needs from one place."
            action={
              <ButtonLink href="/suite/operations/my/events/new" variant="primary" icon={Plus}>
                Plan an event
              </ButtonLink>
            }
          />
        </Card>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="space-y-5">
          <StatGrid>
            <StatCard
              featured
              label="Next event"
              value={stats.next ? dateSpan(stats.next.startsOn, stats.next.endsOn) : "None"}
              icon={CalendarClock}
              href={stats.next ? `/suite/operations/my/events/${stats.next.id}` : undefined}
              hint={stats.next ? stats.next.name : "Nothing approved coming up"}
            />
            <StatCard label="Budget approved or in approval" value={compact(stats.budget)} icon={Wallet} hue="grape" />
            <StatCard label="Drafts to finish" value={stats.drafts} icon={FilePen} hue="slate" />
            <StatCard label="Over, to close out" value={stats.toClose} icon={ClipboardCheck} hue={stats.toClose ? "coral" : "slate"} hint="Attendance and outcomes" />
          </StatGrid>
          <DataView
            rows={shown}
            columns={columns}
            rowKey={(e) => e.id}
            rowHref={(e) => `/suite/operations/my/events/${e.id}`}
            {...listView}
            searchPlaceholder="Search your events"
            caption="Your events"
            gridCols={3}
            renderCard={(e) => <EventCard event={e} />}
            renderListItem={(e) => <EventCard event={e} flat />}
            empty={<p className="px-5 py-10 text-center text-sm text-neutral-500">Nothing here. Try another tab.</p>}
          />
        </div>
      )}
    </div>
  );
}
