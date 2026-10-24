"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Luggage, NotebookPen, Plane, Plus, SearchX, Wallet } from "lucide-react";
import { ButtonLink, Card, Chip, Empty, PageHeader, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { todayYmd } from "@/components/workspace/Calendar";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact } from "@/suite/finance/lib/format";
import { useListView } from "@/suite/finance/components/revenue/ui";
import { opsError, travel, type TripSummary } from "@/lib/api/operations-travel-client";
import { dateSpan, plural, tripStatus } from "../travel/labels";
import { MetaChip } from "../travel/shared";
import { TravellersTag } from "../travel/TripParts";

/**
 * My trips: the ones I raised and the ones I travel on. What is coming up,
 * what is still a draft, and which trip reports I owe.
 */

type Tab = "all" | "upcoming" | "drafts" | "done";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Coming up" },
  { key: "drafts", label: "Drafts" },
  { key: "done", label: "Finished" },
];

const LIVE = ["in_approval", "approved", "booked"];

/** Approved or booked, back home, and no report yet. */
export const reportOwed = (t: TripSummary, today: string) => (t.status === "approved" || t.status === "booked") && t.returnsOn < today;

function inTab(t: TripSummary, tab: Tab, today: string): boolean {
  if (tab === "upcoming") return LIVE.includes(t.status) && t.returnsOn >= today;
  if (tab === "drafts") return t.status === "draft";
  if (tab === "done") return ["completed", "closed", "rejected", "cancelled"].includes(t.status);
  return true;
}

export default function MyTripsBoard() {
  const [rows, setRows] = useState<TripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("all");
  const listView = useListView("ops-my-trips");
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    travel.me.list().then(
      (r) => {
        if (!alive) return;
        setRows(r);
        setError(null);
      },
      (e: unknown) => alive && setError(`Your trips didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const stats = useMemo(() => {
    const upcoming = all.filter((t) => LIVE.includes(t.status) && t.departsOn >= today).sort((a, b) => a.departsOn.localeCompare(b.departsOn));
    const owed = all.filter((t) => reportOwed(t, today));
    const advances = all.filter((t) => t.status === "approved" || t.status === "booked").reduce((s, t) => s + t.advance, 0);
    return { next: upcoming[0] ?? null, upcoming: upcoming.length, owed: owed.length, advances, drafts: all.filter((t) => t.status === "draft").length };
  }, [all, today]);

  const shown = all.filter((t) => inTab(t, tab, today));
  const counts = Object.fromEntries(TABS.map((t) => [t.key, all.filter((x) => inTab(x, t.key, today)).length])) as Record<Tab, number>;

  const columns: Column<TripSummary>[] = [
    {
      key: "trip",
      header: "Trip",
      primary: true,
      sortable: true,
      value: (t) => `${t.destination} ${t.purpose} ${t.number ?? ""}`,
      render: (t) => (
        <span className="block min-w-0">
          <span className="block truncate font-semibold text-neutral-900">{t.destination}</span>
          <span className="block truncate text-xs text-neutral-500">
            {t.number ?? "Draft"} · {t.purpose}
          </span>
        </span>
      ),
    },
    { key: "dates", header: "Dates", sortable: true, value: (t) => t.departsOn, render: (t) => <span className="tabular-nums">{dateSpan(t.departsOn, t.returnsOn)}</span> },
    { key: "status", header: "Status", sortable: true, value: (t) => tripStatus(t.status).label, render: (t) => <MetaChip meta={tripStatus(t.status)} /> },
    { key: "estimate", header: "Estimate", align: "right", sortable: true, value: (t) => t.estimate, render: (t) => <Money value={t.estimate} className="font-semibold" /> },
    { key: "travellers", header: "Travellers", align: "right", hideOnMobile: true, value: (t) => t.travellers },
  ];

  return (
    <div>
      <PageHeader
        title="My trips"
        subtitle="Trips you plan or travel on. Each is costed from the travel policy, approved, then booked by the travel desk."
        actions={
          <ButtonLink href="/suite/operations/my/trips/new" variant="primary" icon={Plus}>
            Plan a trip
          </ButtonLink>
        }
        tabs={rows && rows.length > 0 ? TABS.map((t) => ({ ...t, count: counts[t.key] })) : undefined}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      {error && rows === null && <LoadError text={error} onRetry={() => setReload((k) => k + 1)} />}

      {rows === null && !error && (
        <div aria-busy="true" className="space-y-6">
          <p className="sr-only">Loading your trips…</p>
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
            icon={Luggage}
            title="Plan your first trip"
            hint="Say where and why, who is going and at which grade. DTA, hotel and taxi come from the travel policy, and the advance goes to Finance once the trip is approved."
            action={
              <ButtonLink href="/suite/operations/my/trips/new" variant="primary" icon={Plus}>
                Plan a trip
              </ButtonLink>
            }
          />
        </Card>
      )}

      {rows !== null && rows.length > 0 && (
        <div className="space-y-6">
          <StatGrid>
            <StatCard
              featured
              label="Next trip"
              value={stats.next ? stats.next.destination : "None booked"}
              icon={Plane}
              href={stats.next ? `/suite/operations/my/trips/${stats.next.id}` : undefined}
              hint={stats.next ? dateSpan(stats.next.departsOn, stats.next.returnsOn) : "Nothing coming up"}
            />
            <StatCard label="Coming up" value={stats.upcoming} icon={CalendarClock} hue="sky" hint={stats.drafts ? `${plural(stats.drafts, "draft")} not sent` : "No drafts waiting"} />
            <StatCard label="Advances on live trips" value={compact(stats.advances)} icon={Wallet} hue="mint" hint="DTA, hotel and taxi" />
            <StatCard label="Trip reports to write" value={stats.owed} icon={NotebookPen} hue={stats.owed ? "coral" : "slate"} hint={stats.owed ? "Due within 5 working days of return" : "None owed"} />
          </StatGrid>

          <DataView
            rows={shown}
            columns={columns}
            rowKey={(t) => t.id}
            rowHref={(t) => `/suite/operations/my/trips/${t.id}`}
            {...listView}
            searchPlaceholder="Search your trips"
            caption="Your trips"
            gridCols={3}
            renderCard={(t) => <TripCard trip={t} today={today} />}
            renderListItem={(t) => <TripCard trip={t} today={today} flat />}
            empty={<Empty icon={SearchX} title="No trips here" hint="Try another tab or a different search." />}
          />
        </div>
      )}
    </div>
  );
}

/** A trip as a card: destination, dates, status, travellers and cost; a report owed is called out. */
export function TripCard({ trip: t, today, flat = false }: { trip: TripSummary; today: string; flat?: boolean }) {
  return (
    <div className={flat ? "px-5 py-3.5" : "flex h-full flex-col p-5"}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-neutral-900">{t.destination}</p>
          <p className="mt-0.5 truncate text-xs text-neutral-500">
            {t.number ?? "Draft"} · {t.purpose}
          </p>
        </div>
        <Money value={t.estimate} className="shrink-0 text-[15px] font-bold text-neutral-900" />
      </div>
      <p className="mt-2 text-sm font-medium tabular-nums text-neutral-700">{dateSpan(t.departsOn, t.returnsOn)}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <MetaChip meta={tripStatus(t.status)} />
        {t.overPolicy && <Chip hue="sun" icon={AlertTriangle}>Above policy</Chip>}
        {reportOwed(t, today) && <Chip hue="coral" icon={NotebookPen}>Report owed</Chip>}
        <span className="ml-auto">
          <TravellersTag n={t.travellers} />
        </span>
      </div>
    </div>
  );
}
