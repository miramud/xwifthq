"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, CalendarRange, CheckCheck, CircleCheck, Download, Fuel, Gauge, Plus, ShieldAlert, Users, X } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, PersonAvatar, StatGrid, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { csvDate, downloadCsv } from "@/components/workspace/csv";
import { addDays } from "@/components/workspace/calendar-lanes";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { fleet, opsError, type FleetBoard as Board, type PoolBooking, type VehicleRow } from "@/lib/api/operations-fleet-client";
import { ApproveBookingDialog, VehicleDialog } from "./FleetDialogs";
import { EfficiencyColumns, EfficiencyLegend, FUEL_LABEL, PAPER_STATE, PaperChip, Plate } from "./parts";

/** The vehicles, one row each with every paper's expiry and state, for a spreadsheet. Exported for testing. */
export function vehicleRows(vehicles: VehicleRow[]) {
  const papers = Array.from(new Set(vehicles.flatMap((v) => v.papers.map((p) => p.label))));
  return [
    ["Registration", "Asset tag", "Vehicle", "Driver", "Pool", "Fuel", "Expected km per litre", "Odometer (km)", "Asset status", "Chassis number", "Engine number", ...papers.flatMap((p) => [`${p} expires`, `${p} state`])],
    ...vehicles.map((v) => [
      v.registrationNo,
      v.tagNo ?? "",
      v.name ?? "",
      v.driver ?? "",
      v.pool ? "Yes" : "No",
      FUEL_LABEL[v.fuelType] ?? v.fuelType,
      v.expectedKmPerLitre ?? "",
      v.odometer,
      v.assetStatus ?? "",
      v.chassisNo ?? "",
      v.engineNo ?? "",
      ...papers.flatMap((label) => {
        const p = v.papers.find((x) => x.label === label);
        return p ? [csvDate(p.expiresOn), PAPER_STATE[p.state as keyof typeof PAPER_STATE]?.label ?? p.state] : ["", ""];
      }),
    ]),
  ];
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/**
 * The fleet desk: every vehicle by its plate with its driver, odometer and
 * papers; fuel efficiency month by month against what each should do; and
 * the pool vehicles' bookings for the next three weeks, to approve or
 * decline.
 */
export default function FleetBoard() {
  const { user } = useAuth();
  const router = useRouter();
  const confirm = useConfirm();
  const [board, setBoard] = useState<Board | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(false);
  const [approving, setApproving] = useState<PoolBooking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fleet.board().then(
      (b) => {
        if (!alive) return;
        setBoard(b);
        setError(null);
      },
      (e: unknown) => alive && setError(`The fleet didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const thisMonth = ymd(new Date()).slice(0, 7);
  const lowNow = useMemo(() => (board?.efficiency ?? []).filter((v) => v.months.some((m) => m.month === thisMonth && m.flag)).length, [board, thisMonth]);

  if (error && !board) {
    return (
      <div>
        <PageHeader title="Fleet" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }

  if (!board) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the fleet…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[200px]" />
          ))}
        </div>
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const can = (a: string) => mayDoOps(user, "fleet", a);
  const papers = board.vehicles.flatMap((v) => v.papers);
  const paperIssues = papers.filter((p) => p.state !== "valid").length;
  const toDecide = board.bookings.filter((b) => b.status === "requested");

  const decline = async (b: PoolBooking) => {
    const ok = await confirm({
      title: "Decline this booking?",
      body: `${b.requestedBy ?? "The requester"} asked for ${b.registrationNo ?? "a pool vehicle"} for ${b.purpose}. They are told it was declined.`,
      confirmLabel: "Decline booking",
    });
    if (!ok) return;
    setActionError(null);
    try {
      await fleet.decide(b.id, false);
      setNotice("Booking declined.");
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(opsError(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Fleet"
        subtitle="Vehicles, their papers, fuel and trips, and who has the pool cars when."
        actions={
          can("create") ? (
            <Button variant="primary" icon={Plus} onClick={() => setAdding(true)} disabled={board.unregistered.length === 0} title={board.unregistered.length === 0 ? "Every vehicle on the asset register is already in the fleet" : undefined}>
              Add vehicle
            </Button>
          ) : undefined
        }
      />

      {notice && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-2xl bg-mint-50 px-4 py-3 text-sm text-mint-700 ring-1 ring-mint-500/20">
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}
      {actionError && (
        <p role="alert" className="mb-4 rounded-2xl bg-error-500/5 px-4 py-3 text-sm text-error-700 ring-1 ring-error-500/25">
          {actionError}
        </p>
      )}
      {can("create") && board.unregistered.length > 0 && (
        <p className="mb-6 flex items-start gap-2 rounded-2xl bg-sky-50 px-4 py-3 text-sm text-sky-700 ring-1 ring-sky-500/20">
          <Car size={16} className="mt-0.5 shrink-0" aria-hidden />
          {board.unregistered.length} {board.unregistered.length === 1 ? "vehicle is" : "vehicles are"} on the asset register but not set up in the fleet: {board.unregistered.map((a) => a.tagNo ?? a.name).join(", ")}.
        </p>
      )}

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Vehicles" value={board.vehicles.length} icon={Car} hint={`${board.vehicles.filter((v) => v.pool).length} in the pool`} />
          <StatCard label="Papers to sort" value={paperIssues} icon={ShieldAlert} hue={paperIssues ? "rose" : "mint"} hint={paperIssues ? `${papers.filter((p) => p.state === "expired").length} expired · ${papers.filter((p) => p.state === "expiring").length} expiring · ${papers.filter((p) => p.state === "missing").length} not on file` : "Every paper valid"} href="/suite/operations/compliance" />
          <StatCard label="Low on fuel economy" value={lowNow} icon={Fuel} hue={lowNow ? "sun" : "mint"} hint="This month, under 75% of expected" />
          <StatCard label="Bookings to decide" value={toDecide.length} icon={CalendarRange} hue={toDecide.length ? "grape" : "slate"} hint="Pool vehicle requests" />
        </StatGrid>

        {board.vehicles.length === 0 ? (
          <Card>
            <Empty icon={Car} title="No vehicles in the fleet yet" hint="Put the vehicle on the asset register under the vehicles category, then add it here with its registration and papers." />
          </Card>
        ) : (
          <section aria-labelledby="vehicles-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 id="vehicles-heading" className="text-base font-bold tracking-tight text-neutral-900">
                Vehicles
              </h2>
              <Button size="sm" icon={Download} onClick={() => downloadCsv("fleet-vehicles.csv", vehicleRows(board.vehicles))}>
                Download CSV
              </Button>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {board.vehicles.map((v) => (
                <li key={v.id}>
                  <VehicleCard v={v} />
                </li>
              ))}
            </ul>
          </section>
        )}

        {board.efficiency.length > 0 && (
          <Panel title="Fuel efficiency" subtitle="Six months of km per litre, against what each vehicle should do" icon={Gauge} hue="sky" actions={<EfficiencyLegend expected={null} />}>
            <ul className="grid gap-x-6 gap-y-7 sm:grid-cols-2 xl:grid-cols-3">
              {board.efficiency.map((e) => {
                const flagged = e.months.filter((m) => m.flag).length;
                return (
                  <li key={e.vehicleId} className="min-w-0">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <Link href={`/suite/operations/fleet/${e.vehicleId}`} className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                        <Plate number={e.registrationNo} size="sm" />
                      </Link>
                      <span className="text-right text-xs text-neutral-500">
                        {e.expected !== null ? `Expected ${e.expected} km/l` : "No expected figure"}
                        {flagged > 0 && <span className="block font-semibold text-rose-700">{flagged} low {flagged === 1 ? "month" : "months"}</span>}
                      </span>
                    </div>
                    <EfficiencyColumns months={e.months} expected={e.expected} caption={`${e.registrationNo}: km per litre by month`} height={110} />
                  </li>
                );
              })}
            </ul>
            <p className="mt-5 text-xs text-neutral-500">Dashed line: expected km per litre. Dotted red line: 75% of it, below which a month is flagged. Hatched: no trips or no fuel that month.</p>
          </Panel>
        )}

        <Panel title="Pool bookings" subtitle="This week and the next two" icon={CalendarRange} hue="grape">
          <PoolCalendar vehicles={board.vehicles.filter((v) => v.pool)} bookings={board.bookings} />
          {toDecide.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-sm font-bold tracking-tight text-neutral-900">To decide</h3>
              <ul className="space-y-2">
                {toDecide.map((b) => (
                  <li key={b.id} className="flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-white px-4 py-3 sm:flex-row sm:items-center">
                    <span className="flex min-w-0 flex-1 items-center gap-3">
                      {b.registrationNo && <Plate number={b.registrationNo} size="sm" />}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-neutral-900">
                          {b.purpose}
                          {b.destination ? ` · ${b.destination}` : ""}
                        </span>
                        <span className="block text-xs text-neutral-500">
                          {timeRange(b)}
                          {b.requestedBy ? ` · ${b.requestedBy}` : ""}
                        </span>
                      </span>
                    </span>
                    {can("decide") && (
                      <span className="flex gap-2">
                        <Button size="sm" icon={X} onClick={() => void decline(b)}>
                          Decline
                        </Button>
                        <Button size="sm" variant="primary" icon={CheckCheck} onClick={() => setApproving(b)}>
                          Approve
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      {adding && (
        <VehicleDialog
          vehicle={null}
          unregistered={board.unregistered}
          papers={board.papers}
          onClose={() => setAdding(false)}
          onDone={(v) => {
            setAdding(false);
            router.push(`/suite/operations/fleet/${v.id}`);
          }}
        />
      )}
      {approving && (
        <ApproveBookingDialog
          booking={approving}
          onClose={() => setApproving(null)}
          onDone={(m) => {
            setApproving(null);
            setNotice(m);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function timeRange(b: PoolBooking): string {
  const s = new Date(b.startsAt);
  const e = new Date(b.endsAt);
  const t = (d: Date) => d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return ymd(s) === ymd(e) ? `${day(ymd(s))}, ${t(s)} to ${t(e)}` : `${day(ymd(s))} ${t(s)} to ${day(ymd(e))} ${t(e)}`;
}

function VehicleCard({ v }: { v: VehicleRow }) {
  const bad = v.papers.some((p) => p.state === "expired");
  return (
    <Link
      href={`/suite/operations/fleet/${v.id}`}
      className={cx("ws-card group flex h-full flex-col p-5 outline-none transition hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300", bad && "ring-1 ring-rose-500/30")}
    >
      <span className="flex items-start justify-between gap-3">
        <Plate number={v.registrationNo} />
        {v.pool ? (
          <Chip hue="grape" icon={Users}>
            Pool
          </Chip>
        ) : (
          <Chip hue="sky">Assigned</Chip>
        )}
      </span>
      <span className="mt-4 block truncate text-base font-bold tracking-tight text-neutral-900 group-hover:text-primary-700">{v.name ?? "Vehicle"}</span>
      <span className="block font-mono text-xs text-neutral-500">{v.tagNo ?? "-"}</span>
      <span className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <span className="flex min-w-0 items-center gap-2">
          {v.driver ? <PersonAvatar name={v.driver} size={28} /> : <span className="ws-hatch h-7 w-7 shrink-0 rounded-full" aria-hidden />}
          <span className="min-w-0">
            <span className="block text-[11px] text-neutral-500">Driver</span>
            <span className="block truncate font-medium text-neutral-800">{v.driver ?? "None"}</span>
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-[11px] text-neutral-500">Odometer · {FUEL_LABEL[v.fuelType] ?? v.fuelType}</span>
          <span className="block font-semibold tabular-nums text-neutral-900">{v.odometer.toLocaleString("en-GB")} km</span>
        </span>
      </span>
      <span className="mt-4 flex flex-wrap gap-1.5 border-t border-neutral-100 pt-3">
        {v.papers.length === 0 ? <span className="text-xs text-neutral-500">No papers tracked</span> : v.papers.map((p) => <PaperChip key={p.kind} paper={p} short />)}
      </span>
    </Link>
  );
}

/**
 * Three weeks across, one lane per pool vehicle. Each booking is a bar over
 * its days: approved solid, requested outlined and hatched. Today is marked.
 */
export function PoolCalendar({ vehicles, bookings }: { vehicles: VehicleRow[]; bookings: PoolBooking[] }) {
  const today = ymd(new Date());
  const back = (new Date().getDay() + 6) % 7;
  const start = addDays(today, -back);
  const days = Array.from({ length: 21 }, (_, i) => addDays(start, i));
  const idx = (iso: string) => days.indexOf(ymd(new Date(iso)));
  const lanes = vehicles.length ? vehicles.map((v) => ({ id: v.id, reg: v.registrationNo })) : [...new Map(bookings.map((b) => [b.vehicleId, { id: b.vehicleId, reg: b.registrationNo ?? "" }])).values()];

  if (lanes.length === 0) return <p className="rounded-2xl bg-neutral-50 px-4 py-6 text-center text-sm text-neutral-500">No pool vehicles. Mark a vehicle as pool so staff can book it.</p>;

  return (
    <figure className="-mx-5 overflow-x-auto px-5">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-[7.5rem_repeat(21,minmax(0,1fr))] text-center text-[10px] font-semibold uppercase text-neutral-500" aria-hidden>
          <span />
          {days.map((d) => {
            const dt = new Date(`${d}T00:00:00`);
            const weekend = dt.getDay() === 0 || dt.getDay() === 6;
            return (
              <span key={d} className={cx("border-l border-neutral-100 py-1", d === today && "rounded-t-md bg-primary-50 text-primary-700", weekend && d !== today && "text-neutral-400")}>
                {dt.toLocaleDateString("en-GB", { weekday: "narrow" })}
                <span className="block text-[11px] tabular-nums">{dt.getDate()}</span>
              </span>
            );
          })}
        </div>
        <ul className="divide-y divide-neutral-100 border-y border-neutral-100">
          {lanes.map((lane) => {
            const mine = bookings.filter((b) => b.vehicleId === lane.id);
            return (
              <li key={lane.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center">
                <span className="py-2 pr-2">
                  <Plate number={lane.reg} size="sm" />
                </span>
                <div className="relative grid h-14 grid-cols-21">
                  {days.map((d) => (
                    <span key={d} className={cx("border-l border-neutral-100", d === today && "bg-primary-50/60")} aria-hidden />
                  ))}
                  {mine.map((b) => {
                    const from = Math.max(0, idx(b.startsAt) === -1 ? 0 : idx(b.startsAt));
                    const toRaw = idx(b.endsAt);
                    const to = toRaw === -1 ? 20 : toRaw;
                    const requested = b.status === "requested";
                    return (
                      <span
                        key={b.id}
                        className={cx(
                          "absolute top-1/2 flex h-8 -translate-y-1/2 items-center overflow-hidden rounded-lg px-2 text-[11px] font-semibold",
                          requested ? "ws-hatch border border-dashed border-grape-500 text-grape-700" : "bg-grape-500 text-white",
                        )}
                        style={{ left: `calc(${(100 * from) / 21}% + 2px)`, width: `calc(${(100 * (to - from + 1)) / 21}% - 4px)` }}
                        title={`${b.purpose} · ${timeRange(b)}`}
                      >
                        <span className="truncate">
                          {requested ? "Requested: " : ""}
                          {b.requestedBy ?? b.purpose}
                        </span>
                        <span className="sr-only">
                          {" "}
                          {lane.reg}, {b.purpose}, {timeRange(b)}, {requested ? "waiting for a decision" : `approved${b.driver ? `, driven by ${b.driver}` : ""}`}
                        </span>
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
        <figcaption className="mt-3 flex flex-wrap gap-4 text-xs text-neutral-600">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-5 rounded bg-grape-500" aria-hidden />
            Approved
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="ws-hatch h-2.5 w-5 rounded border border-dashed border-grape-500" aria-hidden />
            Requested
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded bg-primary-50 ring-1 ring-primary-200" aria-hidden />
            Today
          </span>
        </figcaption>
      </div>
    </figure>
  );
}
