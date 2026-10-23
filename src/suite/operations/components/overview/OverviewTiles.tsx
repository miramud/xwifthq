"use client";

import Link from "next/link";
import { ArrowRight, Boxes, Building2, CalendarClock, Gauge, Headset, Plane, ShieldCheck, ShieldX, Star, Store, Truck, Wrench } from "lucide-react";
import { Chip, Panel, Progress, cx } from "@/components/workspace/kit";
import { ColumnChart, Donut, GroupedColumns, StackedColumns, StatusBars } from "@/components/workspace/charts";
import { AgendaList, todayYmd, type CalendarEvent } from "@/components/workspace/Calendar";
import { addDays } from "@/components/workspace/calendar-lanes";
import { hueFor, type Hue } from "@/components/workspace/modules";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day, monthLabel } from "@/suite/finance/lib/format";
import type { AuthUser } from "@/lib/auth-store";
import { mayUseOperations } from "@/suite/operations/lib/operations-access";
import type { Overview, OverviewAssets, OverviewCompliance, OverviewDesk, OverviewFacilities, OverviewStock, OverviewVendors } from "@/lib/api/operations-procurement-client";
import type { MaintenanceSummary } from "@/lib/api/operations-maintenance-client";
import { STATUS_GROUPS } from "@/suite/operations/components/assets/AssetRegister";
import { stageMeta, stageToEvent } from "@/suite/operations/components/compliance/labels";

/**
 * The overview's tiles for compliance, maintenance, facilities and fleet,
 * the service desk, assets, stock, vendors and travel money. Each shows
 * only to somebody who holds that desk, and only when the API sent its
 * figures.
 */
export default function OverviewTiles({ data, user }: { data: Overview; user: AuthUser | null }) {
  const show = {
    assets: Boolean(data.assets) && mayUseOperations(user, "assets", "asset_requests", "asset_verification", "exit_clearances"),
    stock: Boolean(data.stock) && mayUseOperations(user, "stores"),
    compliance: Boolean(data.compliance) && mayUseOperations(user, "compliance"),
    vendors: Boolean(data.vendors) && mayUseOperations(user, "purchase_requests", "purchase_orders", "receiving"),
    travel: Boolean(data.travelMoney) && mayUseOperations(user, "travel_desk"),
    maintenance: Boolean(data.maintenance) && mayUseOperations(user, "maintenance"),
    facilities: Boolean(data.facilities) && mayUseOperations(user, "facilities", "fleet"),
    desk: Boolean(data.desk) && mayUseOperations(user, "service_desk"),
  };
  if (!Object.values(show).some(Boolean)) return null;

  return (
    <div className="space-y-5">
      {show.compliance && data.compliance && <ComplianceTile c={data.compliance} />}
      {show.maintenance && data.maintenance && <MaintenanceTile m={data.maintenance} />}
      {(show.facilities || show.desk) && (
        <div className={cx("grid gap-5", show.facilities && show.desk && "xl:grid-cols-2")}>
          {show.facilities && data.facilities && <FacilitiesTile f={data.facilities} facilities={mayUseOperations(user, "facilities")} fleet={mayUseOperations(user, "fleet")} />}
          {show.desk && data.desk && <DeskTile d={data.desk} />}
        </div>
      )}
      {(show.assets || show.stock) && (
        <div className={cx("grid gap-5", show.assets && show.stock && "xl:grid-cols-2")}>
          {show.assets && data.assets && <AssetsTile a={data.assets} />}
          {show.stock && data.stock && <StockTile s={data.stock} />}
        </div>
      )}
      {(show.vendors || show.travel) && (
        <div className={cx("grid gap-5", show.vendors && show.travel && "xl:grid-cols-3")}>
          {show.vendors && data.vendors && <VendorsTile v={data.vendors} className={show.travel ? "xl:col-span-2" : undefined} />}
          {show.travel && data.travelMoney && <TravelMoneyTile fees={data.travelMoney.changeFeesThisQuarter} />}
        </div>
      )}
    </div>
  );
}

/** A number with its label, linking to the desk that deals with it. */
function Figure({ label, value, href, hue = "slate", hint }: { label: string; value: React.ReactNode; href?: string; hue?: Hue; hint?: string }) {
  const tone: Record<Hue, string> = {
    rose: "text-rose-700",
    sun: "text-sun-700",
    mint: "text-mint-700",
    blue: "text-primary-700",
    sky: "text-sky-700",
    grape: "text-grape-700",
    coral: "text-coral-700",
    slate: "text-neutral-900",
  };
  const body = (
    <>
      <span className="block text-xs text-neutral-500">{label}</span>
      <span className={cx("block text-xl font-bold tabular-nums", tone[hue])}>{value}</span>
      {hint && <span className="block truncate text-[11px] text-neutral-500">{hint}</span>}
    </>
  );
  const cls = "block rounded-xl border border-neutral-200 px-3 py-2.5";
  return href ? (
    <Link href={href} className={cx(cls, "outline-none transition hover:border-neutral-300 hover:bg-neutral-50/60 focus-visible:ring-2 focus-visible:ring-primary-300")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function ComplianceTile({ c }: { c: OverviewCompliance }) {
  const today = todayYmd();
  const events: CalendarEvent[] = c.next
    .filter((n) => n.dueOn)
    .map((n) => ({
      id: n.id,
      date: n.dueOn as string,
      title: n.name ?? "Compliance item",
      meta: [stageMeta(n.stage).label, n.owner].filter(Boolean).join(" · "),
      hue: stageMeta(n.stage).hue,
      status: stageToEvent(n.stage as Parameters<typeof stageToEvent>[0]),
      allDay: true,
      href: `/suite/operations/compliance/${n.id}`,
    }));
  const earliest = events.reduce((m, e) => (e.date < m ? e.date : m), today);
  return (
    <Panel
      title="Compliance"
      subtitle="Filings, remittances and certificates in the next 30 days"
      icon={ShieldCheck}
      hue="mint"
      actions={
        <Link href="/suite/operations/compliance" className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50">
          Open the desk <ArrowRight size={14} aria-hidden />
        </Link>
      }
    >
      {c.expiredMandatory.length > 0 && (
        <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-error-500/25 bg-error-500/5 px-3.5 py-2.5 text-sm text-error-700">
          <ShieldX size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Mandatory {c.expiredMandatory.length === 1 ? "certificate" : "certificates"} expired: </span>
            {c.expiredMandatory.join(", ")}
          </span>
        </p>
      )}
      <div className="grid gap-5 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <div className="grid grid-cols-2 gap-2 self-start">
          <Figure label="Due in 30 days" value={c.dueSoon} href="/suite/operations/compliance" hue={c.dueSoon ? "sun" : "slate"} />
          <Figure label="Overdue" value={c.overdue} href="/suite/operations/compliance" hue={c.overdue ? "rose" : "mint"} />
          <Figure label="Certificates expired" value={c.expired} href="/suite/operations/compliance" hue={c.expired ? "rose" : "mint"} />
          <Figure label="Expiring in 60 days" value={c.expiring} href="/suite/operations/compliance" hue={c.expiring ? "sun" : "slate"} />
        </div>
        <AgendaList events={events} from={earliest} to={addDays(today, 30)} emptyLabel="Nothing falls due in the next 30 days." />
      </div>
    </Panel>
  );
}

function AssetsTile({ a }: { a: OverviewAssets }) {
  const count = (s: string) => a.byStatus[s]?.count ?? 0;
  const groups = STATUS_GROUPS.map((g) => ({ label: g.label, hue: g.hue, value: g.statuses.reduce((sum, s) => sum + count(s), 0) }));
  return (
    <Panel title="Assets" subtitle={`${a.total} on the register · ${compact(a.cost)} at cost`} icon={Boxes} hue="sky">
      {a.total === 0 ? (
        <p className="py-6 text-center text-sm text-neutral-500">The register is empty.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,13rem)]">
          <Donut data={groups} total={a.total} centerLabel="assets" caption="Assets by where they are" size={160} legend="below" />
          <div className="grid grid-cols-2 gap-2 self-start sm:grid-cols-1">
            <Figure label="Lost or stolen" value={a.missing} href="/suite/operations/assets" hue={a.missing ? "rose" : "mint"} />
            <Figure label="Gate passes overdue" value={a.overduePasses} href="/suite/operations/assets/requests" hue={a.overduePasses ? "rose" : "slate"} hint="Taken out, not back" />
            <Figure label="Requests to fulfil" value={a.requestsToFulfil} href="/suite/operations/assets/requests" hue={a.requestsToFulfil ? "sun" : "slate"} />
            <Figure label="Exit clearances open" value={a.clearancesOpen} href="/suite/operations/assets/exit-clearances" hue={a.clearancesOpen ? "sky" : "slate"} />
          </div>
        </div>
      )}
      {a.verification && (
        <div className="mt-5 rounded-xl bg-neutral-50 p-3.5">
          <Progress value={a.verification.percent} hue="sky" label={`Verification: ${a.verification.name}`} showValue />
          <p className="mt-1.5 text-xs text-neutral-500">
            {a.verification.endsOn ? `Ends ${day(a.verification.endsOn)}` : "Under way"}
            {a.verification.missing ? ` · ${a.verification.missing} not found so far` : ""}
          </p>
        </div>
      )}
    </Panel>
  );
}

function StockTile({ s }: { s: OverviewStock }) {
  const total = s.consumption.reduce((sum, m) => sum + m.value, 0);
  return (
    <Panel title="Stock" subtitle="What the stores hold and what goes out of them" icon={Store} hue="grape">
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Stock value" value={compact(s.value)} href="/suite/operations/stores" hue="grape" />
        <Figure label="Below reorder" value={s.belowReorder} href="/suite/operations/stores" hue={s.belowReorder ? "rose" : "mint"} />
        <Figure label="To issue" value={s.requisitionsToIssue} href="/suite/operations/stores/requisitions" hue={s.requisitionsToIssue ? "sun" : "slate"} hint="Approved requisitions" />
      </div>
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Issued, by month · {compact(total)} in six months</p>
        {total === 0 ? (
          <p className="ws-hatch rounded-xl px-4 py-8 text-center text-sm text-neutral-600">Nothing issued from the stores in these months.</p>
        ) : (
          <ColumnChart
            data={s.consumption.map((m) => ({ label: monthLabel(m.month, true).split(" ")[0], value: m.value }))}
            hue="grape"
            height={150}
            format={(v) => compact(v)}
            caption="Value issued from the stores by month"
            highlight="last"
          />
        )}
      </div>
    </Panel>
  );
}

function VendorsTile({ v, className }: { v: OverviewVendors; className?: string }) {
  return (
    <Panel title="Vendors" subtitle="Top vendors by approved orders in the past year" icon={Truck} hue="coral" className={className}>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
        {v.ordersByVendor.length === 0 ? (
          <p className="py-6 text-center text-sm text-neutral-500">No approved orders in the past year.</p>
        ) : (
          <StatusBars
            data={v.ordersByVendor.map((o) => ({ label: o.name, value: o.value, hue: hueFor(o.name), note: `${o.orders} ${o.orders === 1 ? "order" : "orders"}` }))}
            format={(n) => compact(n)}
            caption="Value of approved orders by vendor, past year"
          />
        )}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Rated under 3 of 5</p>
          {v.lowRated.length === 0 ? (
            <p className="text-sm text-neutral-500">No vendor is rated poorly.</p>
          ) : (
            <ul className="space-y-2">
              {v.lowRated.map((r) => (
                <li key={r.name} className="flex items-center justify-between gap-2 rounded-xl border border-rose-500/20 bg-rose-50/50 px-3 py-2 text-sm">
                  <span className="min-w-0 truncate font-medium text-neutral-900">{r.name}</span>
                  <Chip hue="rose" icon={Star}>
                    {r.rating.toFixed(1)}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

function TravelMoneyTile({ fees }: { fees: number }) {
  return (
    <Panel title="Travel changes" subtitle="Fees for changed bookings this quarter" icon={Plane} hue="sky">
      <p className="text-3xl font-bold tabular-nums text-neutral-900">
        <Money value={fees} />
      </p>
      <p className="mt-2 flex items-start gap-2 text-sm text-neutral-600">
        {fees > 0 ? <CalendarClock size={16} className="mt-0.5 shrink-0 text-sun-600" aria-hidden /> : <Gauge size={16} className="mt-0.5 shrink-0 text-mint-600" aria-hidden />}
        {fees > 0 ? "Paid to airlines and hotels for date or name changes. Book once to keep it down." : "No change fees this quarter."}
      </p>
      <Link href="/suite/operations/travel" className="mt-4 inline-flex h-9 items-center gap-1 rounded-xl px-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50">
        Open the travel desk <ArrowRight size={14} aria-hidden />
      </Link>
    </Panel>
  );
}

function DeskLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex h-9 items-center gap-1 rounded-xl px-2 text-[13px] font-semibold text-primary-700 hover:bg-primary-50">
      {label} <ArrowRight size={14} aria-hidden />
    </Link>
  );
}

const PRIORITIES = [
  { key: "critical", label: "Critical", hue: "rose" },
  { key: "high", label: "High", hue: "coral" },
  { key: "normal", label: "Normal", hue: "sun" },
  { key: "low", label: "Low", hue: "sky" },
] as const;

function MaintenanceTile({ m }: { m: MaintenanceSummary }) {
  const open = PRIORITIES.reduce((s, p) => s + (m.open[p.key] ?? 0), 0);
  const cost = m.byMonth.reduce((s, x) => s + x.preventive + x.corrective, 0);
  return (
    <Panel title="Maintenance" subtitle={`${open} open ${open === 1 ? "work order" : "work orders"}`} icon={Wrench} hue="coral" actions={<DeskLink href="/suite/operations/maintenance" label="Open the desk" />}>
      <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Figure label="SLA breached" value={m.slaBreached} href="/suite/operations/maintenance" hue={m.slaBreached ? "rose" : "mint"} hint="Open and past their time" />
            <Figure label="Preventive overdue" value={m.overduePreventive} href="/suite/operations/maintenance/plans" hue={m.overduePreventive ? "sun" : "mint"} />
            <Figure label="Cost this month" value={compact(m.costThisMonth)} hue="grape" />
            <Figure label="SLA met" value={m.slaCompliance === null ? "-" : `${m.slaCompliance}%`} hue={m.slaCompliance === null ? "slate" : m.slaCompliance >= 90 ? "mint" : "sun"} hint="Past year" />
          </div>
          <StatusBars data={PRIORITIES.map((p) => ({ label: p.label, value: m.open[p.key] ?? 0, hue: p.hue }))} caption="Open work orders by priority" />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Cost by month · {compact(cost)} in six months</p>
          {cost === 0 ? (
            <p className="ws-hatch rounded-xl px-4 py-8 text-center text-sm text-neutral-600">No maintenance completed in these months.</p>
          ) : (
            <GroupedColumns
              data={m.byMonth.map((x) => ({ label: monthLabel(x.month, true).split(" ")[0], values: { preventive: x.preventive, corrective: x.corrective } }))}
              series={[
                { key: "preventive", label: "Preventive", hue: "mint" },
                { key: "corrective", label: "Corrective", hue: "coral" },
              ]}
              format={(v) => compact(v)}
              caption="Maintenance cost by month, preventive and corrective"
              height={190}
            />
          )}
        </div>
      </div>
    </Panel>
  );
}

function FacilitiesTile({ f, facilities, fleet }: { f: OverviewFacilities; facilities: boolean; fleet: boolean }) {
  const spend = f.spend.reduce((s, x) => s + x.utilities + x.diesel, 0);
  return (
    <Panel
      title="Facilities and fleet"
      subtitle="Utilities and diesel, renewals, services, vehicle papers and visitors"
      icon={Building2}
      hue="grape"
      actions={facilities ? <DeskLink href="/suite/operations/facilities" label="Open facilities" /> : <DeskLink href="/suite/operations/fleet" label="Open the fleet" />}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label="Renewals in 90 days" value={f.renewals} href={facilities ? "/suite/operations/facilities" : undefined} hue={f.renewals ? "sun" : "slate"} hint="Leases and contracts" />
        <Figure label="Services to confirm" value={f.serviceToConfirm} href={facilities ? "/suite/operations/facilities" : undefined} hue={f.serviceToConfirm ? "sun" : "mint"} hint="Last month's" />
        <Figure label="Vehicle papers" value={f.vehiclePapersExpiring} href={fleet ? "/suite/operations/fleet" : undefined} hue={f.vehiclePapersExpiring ? "rose" : "mint"} hint="Expiring in 30 days" />
        <Figure label="Visitors today" value={f.visitorsToday} href={facilities ? "/suite/operations/facilities" : undefined} hue="sky" />
      </div>
      <div className="mt-5">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Utilities and diesel · {compact(spend)} in six months</p>
        {spend === 0 ? (
          <p className="ws-hatch rounded-xl px-4 py-8 text-center text-sm text-neutral-600">No utility bills or diesel recorded in these months.</p>
        ) : (
          <StackedColumns
            data={f.spend.map((x) => ({ label: monthLabel(x.month, true).split(" ")[0], values: { utilities: x.utilities, diesel: x.diesel } }))}
            series={[
              { key: "utilities", label: "Utilities", hue: "sky" },
              { key: "diesel", label: "Diesel", hue: "sun" },
            ]}
            format={(v) => compact(v)}
            caption="Utility and diesel spend by month"
            height={170}
          />
        )}
      </div>
    </Panel>
  );
}

function DeskTile({ d }: { d: OverviewDesk }) {
  const cats = Object.entries(d.byCategory).sort((a, b) => b[1] - a[1]);
  return (
    <Panel title="Service desk" subtitle={`${d.open} open · ${d.resolvedThisWeek} resolved this week`} icon={Headset} hue="sky" actions={<DeskLink href="/suite/operations/desk" label="Open the desk" />}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Figure label="Open" value={d.open} href="/suite/operations/desk" hue={d.open ? "sky" : "slate"} />
        <Figure label="SLA breached" value={d.breached} href="/suite/operations/desk" hue={d.breached ? "rose" : "mint"} />
        <Figure label="Unassigned" value={d.unassigned} href="/suite/operations/desk" hue={d.unassigned ? "sun" : "mint"} />
        <Figure label="SLA met" value={d.slaMet === null ? "-" : `${d.slaMet}%`} hue={d.slaMet === null ? "slate" : d.slaMet >= 90 ? "mint" : "sun"} />
      </div>
      <div className="mt-5 grid gap-5 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <div className="rounded-xl bg-neutral-50 p-3.5">
          <p className="text-xs text-neutral-500">Satisfaction</p>
          <p className="mt-1 flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-neutral-900">{d.satisfaction === null ? "-" : d.satisfaction.toFixed(1)}</span>
            {d.satisfaction !== null && <span className="text-sm text-neutral-500">of 5</span>}
          </p>
          {d.satisfaction !== null && (
            <span className="mt-1.5 flex gap-0.5" role="img" aria-label={`${d.satisfaction.toFixed(1)} of 5 stars`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} size={14} className={n <= Math.round(d.satisfaction as number) ? "fill-sun-500 text-sun-500" : "text-neutral-300"} aria-hidden />
              ))}
            </span>
          )}
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Open by category</p>
          {cats.length === 0 ? (
            <p className="text-sm text-neutral-500">Nothing open.</p>
          ) : (
            <StatusBars data={cats.slice(0, 6).map(([k, v]) => ({ label: k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, " "), value: v, hue: hueFor(k) }))} caption="Open tickets by category" />
          )}
        </div>
      </div>
    </Panel>
  );
}
