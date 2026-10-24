"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BarChart3, Building, CalendarClock, ChevronRight, DoorOpen, Download, FileSignature, Fuel, Handshake, MapPin, Plus, Receipt, Users } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, StatGrid, ViewAllLink, cx } from "@/components/workspace/kit";
import { StackedColumns, type CategoryDatum } from "@/components/workspace/charts";
import { todayYmd } from "@/components/workspace/Calendar";
import { csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { IconTile, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { amount, compact, day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { facilities, opsError, type FacilitiesBoard, type FacilityRow, type Spend } from "@/lib/api/operations-facilities-client";
import { FacilityDialog } from "./FacilityDialogs";
import { ChipFilter, TankGauge } from "./parts";
import { SPEND_KINDS, daysBetween, expiryStage, kindHue, leftText, litres, monthAbbr, plural } from "./labels";

/**
 * The facilities desk: every site as a card (owned or leased, who works
 * there, what is in the diesel tank, when the lease ends), what the sites
 * spend on utilities and diesel month by month, and the way into leases,
 * contracts, visitors, rooms and the reports.
 */
export default function FacilitiesDesk() {
  const { user } = useAuth();
  const [board, setBoard] = useState<FacilitiesBoard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(false);
  const [site, setSite] = useState("");
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    facilities.list().then(
      (b) => {
        if (!alive) return;
        setBoard(b);
        setError(null);
      },
      (e: unknown) => alive && setError(`The facilities didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const chart = useMemo(() => (board ? spendChart(board.spend, site) : null), [board, site]);

  if (error && !board) {
    return (
      <div>
        <PageHeader title="Facilities" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!board || !chart) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the facilities…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const rows = board.facilities;
  const can = mayDoOps(user, "facilities", "create");
  const headcount = rows.reduce((s, f) => s + (f.headcount ?? 0), 0);
  const tankTotal = rows.reduce((s, f) => s + f.tank, 0);
  const fullest = Math.max(1, ...rows.map((f) => f.tank));
  const leasesSoon = rows.filter((f) => f.lease && daysBetween(today, f.lease.endsOn) <= 120);
  const last = chart.latest;

  /* Every site on the desk, as a spreadsheet opens it. */
  const exportCsv = () =>
    downloadCsv(csvName("facilities", today), [
      ["Code", "Name", "Kind", "Ownership", "Address", "Area (sqm)", "Headcount", "Manager", "Rooms", "Diesel in tank (L)", "Tank capacity (L)", "Lease ends", "Next rent due", "In use"],
      ...rows.map((f) => [
        f.code,
        f.name,
        board.kinds[f.kind] ?? f.kind,
        f.ownership === "leased" ? "Leased" : "Owned",
        f.address ?? "",
        f.areaSqm ?? "",
        f.headcount ?? "",
        f.manager ?? "",
        f.spaces,
        f.tank,
        f.tankLitres ?? "",
        csvDate(f.lease?.endsOn),
        csvDate(f.lease?.nextDueOn),
        f.active ? "Yes" : "No",
      ]),
    ]);

  return (
    <div>
      <PageHeader
        title="Facilities"
        subtitle="Sites and rooms, rent and service contracts, utilities and the diesel that keeps the lights on."
        actions={
          <>
            <Button icon={Download} onClick={exportCsv} disabled={rows.length === 0}>
              Download CSV
            </Button>
            {can && (
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add a site
              </Button>
            )}
          </>
        }
      />

      <div className="space-y-6">
        <nav aria-label="Facilities desks" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {QUICK.map((q) => (
            <Link
              key={q.href}
              href={q.href}
              className="ws-card group flex min-h-[72px] items-center gap-3 px-4 py-3 outline-none transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300"
            >
              <IconTile icon={q.icon} hue={q.hue} size={40} />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-neutral-900">{q.label}</span>
                <span className="block truncate text-xs text-neutral-500">{q.hint}</span>
              </span>
              <ChevronRight size={16} className="ml-auto shrink-0 text-neutral-400 transition group-hover:translate-x-0.5" aria-hidden />
            </Link>
          ))}
        </nav>

        <StatGrid>
          <StatCard featured label="Sites" value={rows.filter((f) => f.active).length} icon={Building} hint={`${plural(headcount, "person", "people")} work across them`} />
          <StatCard label="Diesel in the tanks" value={litres(tankTotal)} icon={Fuel} hue="coral" hint="By the diesel log" />
          <StatCard
            label="Leases ending soon"
            value={leasesSoon.length}
            icon={FileSignature}
            hue={leasesSoon.length ? "sun" : "mint"}
            hint={leasesSoon.length ? "Within 120 days: give notice or renew" : "Nothing ends in the next 120 days"}
            href="/suite/operations/facilities/leases"
          />
          <StatCard
            label={last ? `Spend in ${monthAbbr(last.month, true)}` : "Spend this month"}
            value={last ? compact(last.total) : "-"}
            icon={Receipt}
            hue="grape"
            hint={last && headcount ? `${amount(Math.round(last.total / headcount))} per head` : "Utilities and diesel"}
            href="/suite/operations/facilities/reports"
          />
        </StatGrid>

        <Panel
          title="Utilities and diesel"
          subtitle="What each month cost, by kind. Diesel is what was bought into the tanks."
          icon={BarChart3}
          hue="grape"
          actions={
            <ViewAllLink href="/suite/operations/facilities/reports">Twelve-month report</ViewAllLink>
          }
        >
          {rows.length > 1 && (
            <div className="mb-4">
              <ChipFilter label="Which site" value={site} onChange={setSite} options={[{ key: "", label: "All sites" }, ...rows.map((f) => ({ key: f.id, label: f.name }))]} />
            </div>
          )}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
            <StackedColumns data={chart.data} series={chart.series} format={(v) => compact(v)} caption={`Utility and diesel spend by month${site ? ` at ${rows.find((f) => f.id === site)?.name}` : " across all sites"}`} showTotals />
            <dl className="grid grid-cols-2 gap-3 self-start lg:grid-cols-1">
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <dt className="text-xs font-medium text-neutral-500">Six months</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">{compact(chart.sum)}</dd>
              </div>
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <dt className="text-xs font-medium text-neutral-500">Per head a month</dt>
                <dd className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900">{chart.perHead === null ? "-" : amount(chart.perHead)}</dd>
                <dd className="text-xs text-neutral-500">{chart.perHead === null ? "Set a headcount on the site" : "Average over the six months"}</dd>
              </div>
            </dl>
          </div>
        </Panel>

        <section aria-labelledby="sites-heading">
          <div className="mb-3">
            <h2 id="sites-heading" className="text-base font-bold tracking-tight text-neutral-900">
              Sites
            </h2>
            <p className="text-xs text-neutral-500">Open a site for its rooms, lease, utilities, contracts and diesel log.</p>
          </div>
          {rows.length === 0 ? (
            <div className="ws-card">
              <Empty
                icon={Building}
                title="No sites yet"
                hint="Add the offices, campuses, warehouses and project sites your organisation runs."
                action={
                  can && (
                    <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                      Add a site
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <ul className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((f) => (
                <li key={f.id}>
                  <SiteCard f={f} kinds={board.kinds} fullest={fullest} today={today} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {adding && (
        <FacilityDialog
          kinds={board.kinds}
          onClose={() => setAdding(false)}
          onDone={() => {
            setAdding(false);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

const QUICK = [
  { href: "/suite/operations/facilities/leases", label: "Leases", hint: "Rent and expiry", icon: FileSignature, hue: "sun" as const },
  { href: "/suite/operations/facilities/contracts", label: "Service contracts", hint: "Confirm each month", icon: Handshake, hue: "mint" as const },
  { href: "/suite/operations/facilities/visitors", label: "Visitors", hint: "Today at reception", icon: DoorOpen, hue: "sky" as const },
  { href: "/suite/operations/facilities/rooms", label: "Room bookings", hint: "The week's calendar", icon: CalendarClock, hue: "blue" as const },
  { href: "/suite/operations/facilities/reports", label: "Utilities and diesel", hint: "Twelve months, per head", icon: BarChart3, hue: "grape" as const },
];

function SiteCard({ f, kinds, fullest, today }: { f: FacilityRow; kinds: Record<string, string>; fullest: number; today: string }) {
  const left = f.lease ? daysBetween(today, f.lease.endsOn) : null;
  const stage = left === null ? null : expiryStage(left);
  return (
    <Link
      href={`/suite/operations/facilities/${f.id}`}
      className={cx("ws-card flex h-full flex-col gap-4 p-5 outline-none transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300", !f.active && "opacity-70")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <Chip hue={kindHue(f.kind)} dot>
            {kinds[f.kind] ?? f.kind}
          </Chip>
          <Chip hue={f.ownership === "leased" ? "sun" : "slate"}>{f.ownership === "leased" ? "Leased" : "Owned"}</Chip>
          {!f.active && <Chip>Not in use</Chip>}
        </div>
        <span className="rounded-lg bg-neutral-100 px-2 py-1 font-mono text-[11px] font-semibold text-neutral-600">{f.code}</span>
      </div>
      <div className="min-w-0">
        <p className="truncate text-[15px] font-semibold text-neutral-900">{f.name}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-500">
          <MapPin size={12} className="shrink-0" aria-hidden />
          {f.address ?? "No address on record"}
        </p>
      </div>
      <div className="flex items-end justify-between gap-4">
        <dl className="grid flex-1 grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="flex items-center gap-1 text-xs text-neutral-500">
              <Users size={12} aria-hidden /> Headcount
            </dt>
            <dd className="font-semibold tabular-nums text-neutral-900">{f.headcount ?? "-"}</dd>
          </div>
          <div>
            <dt className="flex items-center gap-1 text-xs text-neutral-500">
              <DoorOpen size={12} aria-hidden /> Rooms
            </dt>
            <dd className="font-semibold tabular-nums text-neutral-900">{f.spaces}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-xs text-neutral-500">Diesel in the tank</dt>
            <dd className="font-semibold tabular-nums text-neutral-900">{litres(f.tank)}</dd>
          </div>
        </dl>
        <TankGauge size="sm" level={f.tank} scale={fullest} capacity={f.tankLitres} label={f.tankLitres ? `${f.name}: ${litres(f.tank)} of diesel in a ${litres(f.tankLitres)} tank` : `${f.name}: ${litres(f.tank)} of diesel, against the fullest site`} />
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-sm">
        {f.lease && stage && left !== null ? (
          <>
            <span className="text-neutral-600">Lease ends {day(f.lease.endsOn)}</span>
            <Chip hue={stage.hue}>{leftText(left)}</Chip>
          </>
        ) : (
          <span className="text-neutral-500">{f.ownership === "leased" ? "No active lease on record" : "Owned: no rent"}</span>
        )}
      </div>
    </Link>
  );
}

/** Six months of spend, stacked by kind, for every site or one. */
function spendChart(spend: Spend, site: string) {
  const sites = spend.facilities.filter((f) => !site || f.facilityId === site);
  const data: CategoryDatum[] = spend.months.map((m) => {
    const values: Record<string, number> = {};
    for (const f of sites) {
      const row = f.months.find((x) => x.month === m);
      for (const [k, v] of Object.entries(row?.byKind ?? {})) values[k] = (values[k] ?? 0) + v;
    }
    return { label: monthAbbr(m), values };
  });
  const used = new Set(data.flatMap((d) => Object.entries(d.values).filter(([, v]) => v > 0).map(([k]) => k)));
  const series = SPEND_KINDS.filter((k) => used.has(k.key)).map((k) => ({ key: k.key, label: k.label, hue: k.hue }));
  const totals = spend.months.map((m) => ({ month: m, total: sites.reduce((s, f) => s + (f.months.find((x) => x.month === m)?.total ?? 0), 0) }));
  const sum = totals.reduce((s, t) => s + t.total, 0);
  const heads = sites.reduce((s, f) => s + (f.headcount ?? 0), 0);
  return {
    data: series.length ? data : [],
    series,
    sum,
    latest: totals.length ? totals[totals.length - 1] : null,
    perHead: heads > 0 && spend.months.length ? Math.round(sum / spend.months.length / heads) : null,
  };
}
