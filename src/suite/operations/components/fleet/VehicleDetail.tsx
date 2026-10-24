"use client";

import { useCallback, useEffect, useState } from "react";
import { CircleCheck, FileWarning, Fuel, Gauge, PenLine, Route, ShieldCheck, ShieldPlus, Wrench } from "lucide-react";
import { Button, Card, Chip, Empty, PageHeader, Panel, PersonAvatar, StatGrid, ViewAllLink, cx } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { BackLink, ErrorNote, IconTile, ListRow, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { Money } from "@/suite/finance/components/banking/ui";
import { compact, day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { ApiError, fleet, opsError, type FuelEntry, type PaperKind, type Trip, type VehicleFull } from "@/lib/api/operations-fleet-client";
import { AssetTag } from "@/suite/operations/components/assets/parts";
import { CLAIM_KIND, CLAIM_STATUS, KIND_LABEL } from "@/suite/operations/components/maintenance/labels";
import { WorkOrderStatusChip } from "@/suite/operations/components/maintenance/parts";
import { FuelDialog, TripDialog, VehicleDialog } from "./FleetDialogs";
import { EfficiencyColumns, EfficiencyLegend, FUEL_LABEL, PAID_VIA_LABEL, PAPER_STATE, Plate, RenewLink } from "./parts";

type Dialog = "edit" | "trip" | "fuel" | null;

const PAPER_LABEL: Record<PaperKind, string> = { licence: "Vehicle licence", roadworthiness: "Roadworthiness certificate", insurance: "Motor insurance", hackney: "Hackney permit" };

/**
 * A vehicle: its plate, driver and odometer; its papers with their expiry
 * and where to renew them; the trip and fuel logs; twelve months of fuel
 * efficiency; and its maintenance and incidents.
 */
export default function VehicleDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [v, setV] = useState<VehicleFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fleet.get(id).then(
      (x) => {
        if (!alive) return;
        setV(x);
        setLoadError(null);
      },
      (e: unknown) => alive && setLoadError(e instanceof ApiError && e.status === 404 ? "This vehicle wasn't found in the fleet." : `This vehicle didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !v) {
    return (
      <div>
        <BackLink href="/suite/operations/fleet" label="Fleet" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (!v) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the vehicle…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[140px]" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const can = (a: string) => mayDoOps(user, "fleet", a);
  const d = new Date();
  const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  const eff = v.efficiency;
  const now = eff?.months.find((m) => m.month === month) ?? null;
  const tracked = new Set(v.papers.map((p) => p.kind));
  const untracked = (Object.keys(PAPER_LABEL) as PaperKind[]).filter((k) => !tracked.has(k));
  const after = (message: string) => {
    setDialog(null);
    setNotice(message);
    refresh();
  };

  const track = async (kind: PaperKind) => {
    setActionError(null);
    try {
      const papers = await fleet.addPaper(v.id, kind);
      setV({ ...v, papers });
      setNotice(`${PAPER_LABEL[kind]} added to the compliance register. Record the paper there.`);
    } catch (e) {
      setActionError(opsError(e));
    }
  };

  const tripColumns: Column<Trip>[] = [
    { key: "on", header: "Date", primary: true, sortable: true, value: (t) => t.tripOn, render: (t) => <span className="font-semibold text-neutral-900">{day(t.tripOn)}</span> },
    {
      key: "purpose",
      header: "Trip",
      value: (t) => `${t.purpose} ${t.origin ?? ""} ${t.destination ?? ""}`,
      render: (t) => (
        <span className="block min-w-0">
          <span className="block truncate text-sm text-neutral-900">{t.purpose}</span>
          {(t.origin || t.destination) && <span className="block truncate text-xs text-neutral-500">{[t.origin, t.destination].filter(Boolean).join(" → ")}</span>}
        </span>
      ),
    },
    { key: "driver", header: "Driver", hideOnMobile: true, value: (t) => t.driver ?? "", render: (t) => <span className="text-sm text-neutral-700">{t.driver ?? "-"}</span> },
    { key: "project", header: "Charged to", hideOnMobile: true, value: (t) => t.project?.name ?? "", render: (t) => <span className="text-sm text-neutral-700">{t.project?.name ?? "Cost centre"}</span> },
    { key: "km", header: "Km", sortable: true, align: "right", value: (t) => t.km, render: (t) => <span className="font-semibold tabular-nums">{t.km.toLocaleString("en-GB")}</span> },
    { key: "odo", header: "Odometer", hideOnMobile: true, align: "right", value: (t) => t.endOdometer, render: (t) => <span className="text-xs tabular-nums text-neutral-500">{t.startOdometer.toLocaleString("en-GB")} → {t.endOdometer.toLocaleString("en-GB")}</span> },
  ];

  const fuelColumns: Column<FuelEntry>[] = [
    { key: "on", header: "Date", primary: true, sortable: true, value: (f) => f.enteredOn, render: (f) => <span className="font-semibold text-neutral-900">{day(f.enteredOn)}</span> },
    { key: "litres", header: "Litres", sortable: true, align: "right", value: (f) => f.litres, render: (f) => <span className="tabular-nums">{f.litres}</span> },
    { key: "amount", header: "Amount", sortable: true, align: "right", value: (f) => f.amount, render: (f) => <Money value={f.amount} className="text-sm" /> },
    { key: "via", header: "Paid with", hideOnMobile: true, value: (f) => f.paidVia ?? "", render: (f) => <span className="text-sm text-neutral-700">{f.paidVia ? PAID_VIA_LABEL[f.paidVia] : "-"}</span> },
    { key: "reading", header: "Odometer", hideOnMobile: true, align: "right", value: (f) => f.reading ?? -1, render: (f) => <span className="text-xs tabular-nums text-neutral-500">{f.reading === null ? "-" : f.reading.toLocaleString("en-GB")}</span> },
  ];

  return (
    <div>
      <BackLink href="/suite/operations/fleet" label="Fleet" />
      <PageHeader
        eyebrow={[v.pool ? "Pool vehicle" : "Assigned vehicle", FUEL_LABEL[v.fuelType]].join(" · ")}
        title={v.name ?? v.registrationNo}
        subtitle={
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <AssetTag tagNo={v.tagNo} size="sm" />
            {v.assetStatus === "under_maintenance" && (
              <Chip hue="coral" icon={Wrench}>
                Under maintenance
              </Chip>
            )}
          </span>
        }
        actions={
          <>
            {can("update") && (
              <Button icon={PenLine} onClick={() => setDialog("edit")}>
                Edit
              </Button>
            )}
            {can("fuel") && (
              <Button icon={Fuel} onClick={() => setDialog("fuel")}>
                Record fuel
              </Button>
            )}
            {can("trip") && (
              <Button variant="primary" icon={Route} onClick={() => setDialog("trip")}>
                Log a trip
              </Button>
            )}
          </>
        }
      />

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}
      {notice && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-2xl bg-mint-50 px-4 py-3 text-sm text-mint-700 ring-1 ring-mint-500/20">
          <CircleCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
          {notice}
        </p>
      )}

      <Card className="mb-6">
        <div className="flex flex-col gap-6 p-5 md:flex-row md:items-center">
          <Plate number={v.registrationNo} size="lg" />
          <dl className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="flex items-center gap-2.5">
              {v.driver ? <PersonAvatar name={v.driver} size={36} /> : <span className="ws-hatch h-9 w-9 rounded-full" aria-hidden />}
              <div className="min-w-0">
                <dt className="text-xs text-neutral-500">Driver</dt>
                <dd className="truncate text-sm font-semibold text-neutral-900">{v.driver ?? "None"}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Odometer</dt>
              <dd className="text-sm font-semibold tabular-nums text-neutral-900">{v.odometer.toLocaleString("en-GB")} km</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Chassis</dt>
              <dd className="truncate font-mono text-sm text-neutral-800">{v.chassisNo ?? "-"}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-500">Engine</dt>
              <dd className="truncate font-mono text-sm text-neutral-800">{v.engineNo ?? "-"}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Km this month" value={(now?.km ?? 0).toLocaleString("en-GB")} unit="km" icon={Route} hint={`${v.trips.length} trips logged`} />
          <StatCard label="Fuel this month" value={compact(now?.cost ?? 0)} icon={Fuel} hue="sun" hint={`${now?.litres ?? 0} litres`} />
          <StatCard
            label="Km per litre"
            value={now?.kmPerLitre ?? "-"}
            icon={Gauge}
            hue={now?.flag ? "rose" : "sky"}
            hint={eff?.expected ? `Expected ${eff.expected}${now?.flag ? " · low this month" : ""}` : "No expected figure"}
          />
          <StatCard label="Open work orders" value={v.workOrders.filter((w) => ["open", "assigned", "in_progress", "awaiting_parts"].includes(w.status)).length} icon={Wrench} hue="coral" hint={`${v.workOrders.length} in all`} />
        </StatGrid>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="Fuel efficiency" subtitle="Twelve months of km per litre" icon={Gauge} hue="sky" actions={<EfficiencyLegend expected={eff?.expected ?? null} />}>
            {eff ? <EfficiencyColumns months={eff.months} expected={eff.expected} caption={`${v.registrationNo}: km per litre by month, twelve months`} height={180} /> : <Empty icon={Gauge} hue="sky" title="No trips or fuel recorded yet" />}
          </Panel>

          <Panel title="Papers" subtitle="Kept on the compliance register" icon={ShieldCheck} hue="mint">
            {v.papers.length === 0 ? (
              <Empty icon={ShieldCheck} hue="mint" title="No papers tracked" />
            ) : (
              <ul className="space-y-2.5">
                {v.papers.map((p) => {
                  const m = PAPER_STATE[p.state] ?? PAPER_STATE.missing;
                  const Icon = m.icon;
                  return (
                    <li key={p.kind} className={cx("flex items-center gap-3 rounded-2xl border px-3 py-2.5", p.state === "expired" ? "border-rose-500/30 bg-rose-50/40" : "border-neutral-100 bg-white")}>
                      <IconTile icon={Icon} hue={m.hue} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-neutral-900">{p.label}</span>
                        <span className="block text-xs text-neutral-500">
                          {m.label}
                          {p.expiresOn ? ` · ${p.state === "expired" ? "expired" : "expires"} ${day(p.expiresOn)}` : ""}
                          {p.reference ? ` · ${p.reference}` : ""}
                        </span>
                      </span>
                      <RenewLink paper={p} />
                    </li>
                  );
                })}
              </ul>
            )}
            {can("paper") && untracked.length > 0 && (
              <div className="mt-4 border-t border-neutral-100 pt-3">
                <p className="mb-2 text-xs font-medium text-neutral-500">Also track</p>
                <div className="flex flex-wrap gap-2">
                  {untracked.map((k) => (
                    <Button key={k} size="sm" icon={ShieldPlus} onClick={() => void track(k)}>
                      {PAPER_LABEL[k]}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </Panel>
        </div>

        <section aria-labelledby="trips-heading">
          <h2 id="trips-heading" className="mb-3 text-base font-bold tracking-tight text-neutral-900">
            Trip log
          </h2>
          <DataView
            rows={v.trips}
            columns={tripColumns}
            rowKey={(t) => t.id}
            storageKey="ops-fleet-trips"
            views={["table", "list"]}
            searchPlaceholder="Search trips"
            caption="Trips"
            empty={<p className="py-8 text-center text-sm text-neutral-500">No trips logged. Each trip moves the odometer and counts towards servicing.</p>}
          />
        </section>

        <section aria-labelledby="fuel-heading">
          <h2 id="fuel-heading" className="mb-3 text-base font-bold tracking-tight text-neutral-900">
            Fuel log
          </h2>
          <DataView
            rows={v.fuel}
            columns={fuelColumns}
            rowKey={(f) => f.id}
            storageKey="ops-fleet-fuel"
            views={["table", "list"]}
            searchable={false}
            caption="Fuel"
            empty={<p className="py-8 text-center text-sm text-neutral-500">No fuel recorded.</p>}
          />
        </section>

        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Maintenance" subtitle="Work orders on this vehicle" icon={Wrench} hue="coral">
            {v.workOrders.length === 0 ? (
              <Empty icon={Wrench} hue="coral" title="No work orders yet" />
            ) : (
              <ul className="-mx-2 divide-y divide-neutral-100">
                {v.workOrders.map((w) => (
                  <ListRow
                    key={w.id}
                    href={`/suite/operations/maintenance/${w.id}`}
                    leading={<IconTile icon={Wrench} hue="coral" />}
                    title={w.title}
                    meta={
                      <span className="font-mono">
                        {w.number} · <span className="font-sans">{KIND_LABEL[w.kind] ?? w.kind}</span> · {day(w.createdAt)}
                      </span>
                    }
                    trailing={
                      <span className="flex flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                        <WorkOrderStatusChip status={w.status} />
                        <Money value={w.cost} className="text-right text-sm sm:w-24" />
                      </span>
                    }
                  />
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Incidents"
            subtitle="Insurance claims on this vehicle"
            icon={FileWarning}
            hue="rose"
            actions={<ViewAllLink href="/suite/operations/maintenance/claims">All insurance claims</ViewAllLink>}
          >
            {v.incidents.length === 0 ? (
              <Empty icon={FileWarning} hue="rose" title="No incidents recorded" />
            ) : (
              <ul className="-mx-2 divide-y divide-neutral-100">
                {v.incidents.map((c) => {
                  const m = CLAIM_STATUS[c.status] ?? CLAIM_STATUS.open;
                  return (
                    <ListRow
                      key={c.id}
                      leading={<IconTile icon={FileWarning} hue="rose" />}
                      title={
                        <>
                          {CLAIM_KIND[c.kind] ?? c.kind} · {day(c.incidentOn)}
                        </>
                      }
                      meta={
                        <>
                          Claimed <Money value={c.amountClaimed} />
                          {c.amountSettled !== null && (
                            <>
                              {" "}
                              · settled <Money value={c.amountSettled} />
                            </>
                          )}
                        </>
                      }
                      trailing={
                        <Chip hue={m.hue} icon={m.icon}>
                          {m.label}
                        </Chip>
                      }
                    />
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {dialog === "edit" && <VehicleDialog vehicle={v} unregistered={[]} papers={PAPER_LABEL} onClose={() => setDialog(null)} onDone={(_, m) => after(m)} />}
      {dialog === "trip" && <TripDialog vehicle={v} onClose={() => setDialog(null)} onDone={after} />}
      {dialog === "fuel" && <FuelDialog vehicle={v} onClose={() => setDialog(null)} onDone={after} />}
    </div>
  );
}
