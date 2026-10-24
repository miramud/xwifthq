"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarRange, CircleDollarSign, NotebookPen, PlaneTakeoff, RefreshCw, SearchX, SlidersHorizontal, TicketCheck } from "lucide-react";
import { ButtonLink, Card, Chip, Empty, PageHeader, Panel, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { ColumnChart, StatusBars } from "@/components/workspace/charts";
import { hueFor, type Hue } from "@/components/workspace/modules";
import { todayYmd } from "@/components/workspace/Calendar";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { amount, compact } from "@/suite/finance/lib/format";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import { opsError, travel, type TravelDeskMeta, type TripSummary } from "@/lib/api/operations-travel-client";
import { TRIP_STATUS, TRIP_STATUS_ORDER, dateSpan, plural, tripStatus } from "./labels";
import { MetaChip } from "./shared";
import SpanCalendar from "./SpanCalendar";

/**
 * The travel desk: every trip past draft on a month calendar, what is
 * waiting to be booked or changed, which trip reports are late, what flight
 * changes have cost and why, and travel spend by project.
 */

type Tab = "all" | "in_approval" | "approved" | "booked" | "done";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "in_approval", label: "In approval" },
  { key: "approved", label: "To book" },
  { key: "booked", label: "Booked" },
  { key: "done", label: "Finished" },
];

function inTab(t: TripSummary, tab: Tab): boolean {
  if (tab === "all") return true;
  if (tab === "done") return ["completed", "closed", "rejected", "cancelled"].includes(t.status);
  return t.status === tab;
}

/** Reasons keep their own colour on every chart. */
const REASON_HUE: Record<string, Hue> = { client_driven: "sky", internal_schedule: "grape", personal: "coral", force_majeure: "slate" };

export default function TravelDeskBoard() {
  const [data, setData] = useState<{ trips: TripSummary[]; meta: TravelDeskMeta } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("all");
  const listView = useListView("ops-travel-desk");
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    travel.desk.list().then(
      (r) => {
        if (!alive) return;
        setData(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`The travel desk didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const trips = useMemo(() => data?.trips ?? [], [data]);
  const counts = Object.fromEntries(TABS.map((t) => [t.key, trips.filter((x) => inTab(x, t.key)).length])) as Record<Tab, number>;
  const shown = trips.filter((t) => inTab(t, tab));

  const calendarItems = useMemo(
    () =>
      trips
        .filter((t) => t.status !== "rejected" && t.status !== "cancelled")
        .map((t) => ({
          id: t.id,
          from: t.departsOn,
          to: t.returnsOn,
          title: t.destination,
          meta: t.requester ?? undefined,
          hue: tripStatus(t.status).hue,
          href: `/suite/operations/travel/${t.id}`,
        })),
    [trips],
  );
  const legend = TRIP_STATUS_ORDER.filter((s) => s !== "rejected" && s !== "cancelled" && trips.some((t) => t.status === s)).map((s) => ({ label: TRIP_STATUS[s].label, hue: TRIP_STATUS[s].hue }));

  const columns: Column<TripSummary>[] = [
    {
      key: "trip",
      header: "Trip",
      primary: true,
      sortable: true,
      value: (t) => `${t.destination} ${t.number ?? ""} ${t.requester ?? ""}`,
      render: (t) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{t.destination}</span>
          <span className="block truncate text-xs text-neutral-500">
            {t.number} · {t.requester}
          </span>
        </span>
      ),
    },
    { key: "dates", header: "Dates", sortable: true, value: (t) => t.departsOn, render: (t) => <span className="tabular-nums">{dateSpan(t.departsOn, t.returnsOn)}</span> },
    { key: "project", header: "Project", sortable: true, hideOnMobile: true, value: (t) => t.project?.name ?? "Cost centre" },
    { key: "status", header: "Status", sortable: true, value: (t) => tripStatus(t.status).label, render: (t) => <DeskStatus trip={t} today={today} /> },
    { key: "estimate", header: "Estimate", align: "right", sortable: true, value: (t) => t.estimate, render: (t) => <Money value={t.estimate} className="font-semibold" /> },
  ];

  if (error && !data) return <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />;

  if (!data) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the travel desk…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[560px]" />
      </div>
    );
  }

  const m = data.meta;
  const reasons = m.changes.byReason.map((r) => ({ label: r.label, value: r.fees, hue: REASON_HUE[r.reason] ?? hueFor(r.reason) }));
  const changeCount = m.changes.byReason.reduce((s, r) => s + r.count, 0);

  return (
    <div>
      <PageHeader
        title="Travel desk"
        subtitle="Book approved trips, carry out approved changes, and keep an eye on what changes cost."
        actions={
          <ButtonLink href="/suite/operations/travel/policy" icon={SlidersHorizontal}>
            Travel policy
          </ButtonLink>
        }
        tabs={trips.length > 0 ? TABS.map((t) => ({ ...t, count: counts[t.key] })) : undefined}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Trips to book" value={m.toBook} icon={TicketCheck} hint={m.toBook ? "Approved, nothing booked yet" : "Everything approved is booked"} />
          <StatCard label="Changes to carry out" value={m.changesToExecute} icon={RefreshCw} hue={m.changesToExecute ? "sun" : "slate"} hint="Approved, not yet done at the agency" />
          <StatCard label="Trip reports overdue" value={m.reportsDue} icon={NotebookPen} hue={m.reportsDue ? "rose" : "slate"} hint="Back over 5 days, no report" />
          <StatCard label="Change and cancellation fees" value={compact(m.changes.total)} icon={CircleDollarSign} hue="coral" hint={`${plural(changeCount, "change")} approved · ${amount(m.changes.total)}`} />
        </StatGrid>

        {trips.length === 0 ? (
          <Card>
            <Empty
              icon={PlaneTakeoff}
              title="No trips have reached the desk yet"
              hint="Trips show here once the traveller sends them for approval. You book approved trips from here, and set the rates staff are costed at in the travel policy."
              action={
                <ButtonLink href="/suite/operations/travel/policy" icon={SlidersHorizontal}>
                  Review the travel policy
                </ButtonLink>
              }
            />
          </Card>
        ) : (
          <Panel title="Travel calendar" subtitle="Each trip from departure to return" icon={CalendarRange} hue="sky">
            <SpanCalendar items={calendarItems} legend={legend} label="Trips by month" emptyLabel="Nobody is travelling this month." />
          </Panel>
        )}

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="What changes cost" subtitle="Approved change and cancellation fees, by reason" icon={RefreshCw} hue="coral">
            {m.changes.total === 0 ? (
              <Empty icon={RefreshCw} hue="coral" title="No change fees yet" hint="They show here by reason and project as changes are approved." />
            ) : (
              <div className="space-y-6">
                <ColumnChart
                  data={reasons}
                  height={180}
                  format={(v) => compact(v)}
                  caption="Change and cancellation fees by reason"
                />
                <ul className="flex flex-wrap gap-2" aria-label="Changes by reason">
                  {m.changes.byReason.map((r) => (
                    <li key={r.reason}>
                      <Chip hue={REASON_HUE[r.reason] ?? "slate"} dot>
                        {r.label}: {plural(r.count, "change")}
                      </Chip>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-neutral-100 pt-5">
                  <p className="mb-3 text-sm font-semibold text-neutral-900">By project</p>
                  <StatusBars
                    data={m.changes.byProject.map((p) => ({ label: p.project, value: p.fees, hue: hueFor(p.project), note: plural(p.count, "change") }))}
                    format={(v) => amount(v)}
                    caption="Change fees by project"
                  />
                </div>
              </div>
            )}
          </Panel>

          <Panel title="Travel spend by project" subtitle="Estimates of trips past approval" icon={CircleDollarSign} hue="grape">
            {m.spendByProject.length === 0 ? (
              <Empty icon={CircleDollarSign} hue="grape" title="No approved travel yet" hint="Trip estimates show here by project once trips pass approval." />
            ) : (
              <StatusBars
                data={[...m.spendByProject]
                  .sort((a, b) => b.total - a.total)
                  .map((p) => ({ label: p.project?.name ?? "Cost centres", value: p.total, hue: p.project ? hueFor(p.project.name) : "slate", note: plural(p.trips, "trip") }))}
                format={(v) => amount(v)}
                caption="Travel spend by project"
              />
            )}
          </Panel>
        </div>

        {trips.length > 0 && (
          <DataView
            rows={shown}
            columns={columns}
            rowKey={(t) => t.id}
            rowHref={(t) => `/suite/operations/travel/${t.id}`}
            {...listView}
            searchPlaceholder="Search by destination, traveller or number"
            caption="Trips"
            gridCols={3}
            onDownload={(rows) => exportTrips(rows, tab)}
            renderListItem={(t) => <DeskTripRow trip={t} today={today} />}
            renderCard={(t) => <DeskTripRow trip={t} today={today} card />}
            empty={<Empty icon={SearchX} title="No trips here" hint="Try another tab or a different search." />}
          />
        )}
      </div>
    </div>
  );
}

/** The trips as listed, for a spreadsheet. Pure apart from the download; exported for testing. */
export function tripRows(rows: TripSummary[]) {
  return [
    ["Number", "Destination", "Type", "Purpose", "Traveller", "Travellers", "Departs", "Returns", "Project", "Status", "Above policy", "Advance", "Estimate", "Currency"],
    ...rows.map((t) => [
      t.number ?? "",
      t.destination,
      t.tripType === "international" ? "International" : "Local",
      t.purpose,
      t.requester ?? "",
      t.travellers,
      csvDate(t.departsOn),
      csvDate(t.returnsOn),
      t.project?.name ?? "Cost centre",
      tripStatus(t.status).label,
      t.overPolicy ? "Yes" : "No",
      csvAmount(t.advance),
      csvAmount(t.estimate),
      "NGN",
    ]),
  ];
}

function exportTrips(rows: TripSummary[], tab: Tab) {
  downloadCsv(`travel-desk${tab === "all" ? "" : `_${tab}`}.csv`, tripRows(rows));
}

/** Status, plus what the desk owes it: a booking, or a chase for the report. */
function DeskStatus({ trip: t, today }: { trip: TripSummary; today: string }) {
  const late = (t.status === "approved" || t.status === "booked") && t.returnsOn < today;
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <MetaChip meta={tripStatus(t.status)} />
      {late && (
        <Chip hue="rose" icon={NotebookPen}>
          Report due
        </Chip>
      )}
      {t.overPolicy && (
        <Chip hue="sun" icon={AlertTriangle}>
          Above policy
        </Chip>
      )}
    </span>
  );
}

function DeskTripRow({ trip: t, today, card = false }: { trip: TripSummary; today: string; card?: boolean }) {
  return (
    <div className={card ? "flex h-full flex-col p-5" : "px-5 py-3.5"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{t.destination}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {t.number} · {t.requester} · {plural(t.travellers, "traveller")}
          </p>
        </div>
        <Money value={t.estimate} className="shrink-0 text-[15px] font-bold text-neutral-900" />
      </div>
      <p className="mt-2 text-sm font-medium tabular-nums text-neutral-700">{dateSpan(t.departsOn, t.returnsOn)}</p>
      <div className="mt-3">
        <DeskStatus trip={t} today={today} />
      </div>
    </div>
  );
}
