"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DoorOpen, FileSignature, Fuel, Gauge, Handshake, MapPin, PenLine, Plug, Plus, Receipt, Users } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { MultiLine, Sparkline } from "@/components/workspace/charts";
import { todayYmd } from "@/components/workspace/Calendar";
import { HUE } from "@/components/workspace/modules";
import { BackLink, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { facilities, opsError, type FacilityDetail as Detail, type Space, type UtilityAccount } from "@/lib/api/operations-facilities-client";
import { BillDialog, DieselDialog, FacilityDialog, LeaseDialog, SpaceDialog, UtilityDialog } from "./FacilityDialogs";
import { LeaseCard, LeaseDrawer } from "./LeaseParts";
import { CounterpartyLink } from "../links";
import { TankGauge } from "./parts";
import { SPACE_KINDS, expiryStage, kindHue, leftText, litres, monthAbbr, plural, spendKind, tankLevels } from "./labels";

type Tab = "rooms" | "leases" | "utilities" | "contracts" | "diesel";

type Dialog =
  | { kind: "edit" }
  | { kind: "space"; space?: Space }
  | { kind: "lease"; leaseId?: string }
  | { kind: "utility"; utility?: UtilityAccount }
  | { kind: "bill"; utility: UtilityAccount }
  | { kind: "diesel" }
  | { kind: "view-lease"; leaseId: string };

const KINDS: Record<string, string> = { campus: "Campus", office: "Office", site: "Project site", warehouse: "Warehouse" };

/**
 * A site: its rooms, its lease and the rent it runs, utility accounts and
 * their bills, the service contracts that keep it running, and the diesel
 * log with the tank's level over time.
 */
export default function FacilityDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const [f, setF] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<Tab>("rooms");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    facilities.get(id).then(
      (d) => {
        if (!alive) return;
        setF(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`This site didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const levels = useMemo(() => (f ? tankLevels(f.diesel, f.tank) : []), [f]);

  if (error && !f) {
    return (
      <div>
        <BackLink href="/suite/operations/facilities" label="Facilities" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!f) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the site…</p>
        <Skeleton className="h-24" />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[120px]" />
          ))}
        </div>
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const can = (a: string) => mayDoOps(user, "facilities", a);
  const done = (msg: string) => {
    setDialog(null);
    setNotice(msg);
    setReload((n) => n + 1);
  };
  const active = f.leases.find((l) => l.status === "active") ?? null;
  const peak = f.tankLitres ?? Math.max(f.tank, ...levels.map((l) => l.level), 1);

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: "rooms", label: "Rooms", count: f.spaces.length },
    { key: "leases", label: "Lease", count: f.leases.length },
    { key: "utilities", label: "Utilities", count: f.utilities.length },
    { key: "contracts", label: "Contracts", count: f.contracts.length },
    { key: "diesel", label: "Diesel" },
  ];

  return (
    <div>
      <BackLink href="/suite/operations/facilities" label="Facilities" />
      <PageHeader
        eyebrow={f.code}
        title={f.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Chip hue={kindHue(f.kind)} dot>
              {KINDS[f.kind] ?? f.kind}
            </Chip>
            <Chip hue={f.ownership === "leased" ? "sun" : "slate"}>{f.ownership === "leased" ? "Leased" : "Owned"}</Chip>
            {!f.active && <Chip>Not in use</Chip>}
            {f.address && (
              <span className="inline-flex items-center gap-1 text-neutral-500">
                <MapPin size={13} aria-hidden /> {f.address}
              </span>
            )}
          </span>
        }
        actions={
          <>
            {can("diesel") && (
              <Button icon={Fuel} onClick={() => setDialog({ kind: "diesel" })}>
                Record diesel
              </Button>
            )}
            {can("update") && (
              <Button icon={PenLine} onClick={() => setDialog({ kind: "edit" })}>
                Edit site
              </Button>
            )}
          </>
        }
        tabs={tabs.map((t) => ({ key: t.key, label: t.label, count: t.count }))}
        activeTab={tab}
        onTab={(k) => setTab(k as Tab)}
      />

      <Notice text={notice} />

      <div className="space-y-5">
        <StatGrid>
          <StatCard label="Headcount" value={f.headcount ?? "-"} icon={Users} hue="blue" hint={f.manager ? `Managed by ${f.manager}` : "No facility manager set"} />
          <StatCard label="Rooms" value={f.spaces.length} icon={DoorOpen} hue="sky" hint={`${f.spaces.filter((s) => s.bookable).length} bookable by staff`} />
          <StatCard label="Diesel in the tank" value={litres(f.tank)} icon={Fuel} hue={f.tank < peak * 0.2 ? "rose" : "coral"} hint={f.generators.length ? plural(f.generators.length, "generator") : "No generator on the register"} />
          <StatCard
            label="Lease"
            value={active ? leftText(active.daysLeft) : f.ownership === "owned" ? "Owned" : "None"}
            icon={FileSignature}
            hue={active ? expiryStage(active.daysLeft).hue : "slate"}
            hint={active ? `Ends ${day(active.endsOn)}` : "No active lease"}
          />
        </StatGrid>

        {tab === "rooms" && (
          <Panel
            title="Rooms"
            subtitle="Meeting rooms, offices, labs and stores at this site."
            icon={DoorOpen}
            hue="sky"
            actions={
              can("create_space") && (
                <Button size="sm" variant="primary" icon={Plus} onClick={() => setDialog({ kind: "space" })}>
                  Add a room
                </Button>
              )
            }
          >
            {f.spaces.length === 0 ? (
              <Empty icon={DoorOpen} hue="sky" title="No rooms yet" hint="Add the meeting rooms staff can book, and the other spaces you run." />
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {f.spaces.map((s) => (
                  <li key={s.id} className="flex items-start gap-3 rounded-2xl border border-neutral-200/80 p-4">
                    <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[s.bookable ? "sky" : "slate"].soft)}>
                      <DoorOpen size={18} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-neutral-900">{s.name}</p>
                      <p className="text-xs text-neutral-500">
                        {SPACE_KINDS[s.kind] ?? s.kind}
                        {s.capacity ? ` · seats ${s.capacity}` : ""}
                      </p>
                      <div className="mt-2">{s.bookable ? <Chip hue="mint">Bookable</Chip> : <Chip>Not bookable</Chip>}</div>
                    </div>
                    {can("update_space") && (
                      <Button size="sm" variant="ghost" icon={PenLine} aria-label={`Edit ${s.name}`} onClick={() => setDialog({ kind: "space", space: s })}>
                        <span className="sr-only sm:not-sr-only">Edit</span>
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {tab === "leases" && (
          <section aria-labelledby="leases-h" className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 id="leases-h" className="text-[15px] font-semibold text-neutral-900">
                  Lease and rent
                </h2>
                <p className="text-xs text-neutral-500">Each instalment becomes a payment memo ahead of its due date, escalation applied.</p>
              </div>
              {can("create_lease") && (
                <Button size="sm" variant="primary" icon={Plus} onClick={() => setDialog({ kind: "lease" })}>
                  Add a lease
                </Button>
              )}
            </div>
            {f.leases.length === 0 ? (
              <div className="ws-card">
                <Empty icon={FileSignature} hue="sun" title="No lease on record" hint={f.ownership === "owned" ? "The site is owned. Add a lease only if part of it is rented." : "Add the lease so its rent is raised on time."} />
              </div>
            ) : (
              f.leases.map((l) => <LeaseCard key={l.id} lease={l} today={today} onOpen={() => setDialog({ kind: "view-lease", leaseId: l.id })} onEdit={can("update_lease") ? () => setDialog({ kind: "lease", leaseId: l.id }) : undefined} />)
            )}
          </section>
        )}

        {tab === "utilities" && (
          <Panel
            title="Utility accounts"
            subtitle="Electricity, water, internet and the rest: each month's bill."
            icon={Plug}
            hue="sun"
            actions={
              can("create_utility") && (
                <Button size="sm" variant="primary" icon={Plus} onClick={() => setDialog({ kind: "utility" })}>
                  Add an account
                </Button>
              )
            }
          >
            {f.utilities.length === 0 ? (
              <Empty icon={Plug} hue="sun" title="No utility accounts" hint="Add the meters and service accounts, then enter each month's bill." />
            ) : (
              <ul className="grid gap-4 lg:grid-cols-2">
                {f.utilities.map((u) => (
                  <li key={u.id}>
                    <UtilityCard
                      u={u}
                      onBill={can("bill") ? () => setDialog({ kind: "bill", utility: u }) : undefined}
                      onEdit={can("update_utility") ? () => setDialog({ kind: "utility", utility: u }) : undefined}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}

        {tab === "contracts" && (
          <Panel
            title="Service contracts at this site"
            subtitle="Cleaning, security, AC and generator servicing: each month is confirmed before it is paid."
            icon={Handshake}
            hue="mint"
            actions={
              <Link href="/suite/operations/facilities/contracts" className="text-sm font-semibold text-primary-700 hover:underline">
                Confirm months
              </Link>
            }
          >
            {f.contracts.length === 0 ? (
              <Empty icon={Handshake} hue="mint" title="No contracts at this site" hint="Add them on the service contracts page." />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {f.contracts.map((c) => {
                  const st = expiryStage(c.daysLeft);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-neutral-900">{c.serviceLabel}</p>
                        <p className="text-xs text-neutral-500">
                          <CounterpartyLink id={c.vendorId} name={c.vendor} fallback="Vendor not recorded" />
                          {[c.reference, c.officer ? `Officer: ${c.officer}` : null].filter(Boolean).map((t) => ` · ${t}`).join("")}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold tabular-nums text-neutral-900">
                          {amount(c.periodAmount)}
                          <span className="font-normal text-neutral-500"> / {c.frequency === "quarterly" ? "quarter" : "month"}</span>
                        </span>
                        {c.status === "active" ? <Chip hue={st.hue}>{leftText(c.daysLeft)}</Chip> : <Chip>{c.status === "terminated" ? "Terminated" : "Ended"}</Chip>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        )}

        {tab === "diesel" && (
          <div className="grid gap-5 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <Panel title="The tank" icon={Gauge} hue="coral" subtitle="By the log: bought in, less what the generators used.">
              <TankGauge level={f.tank} scale={peak} capacity={f.tankLitres} label={`Diesel in the tank at ${f.name}`} />
              {f.generators.length > 0 && (
                <ul className="mt-5 space-y-2 border-t border-neutral-100 pt-4">
                  {f.generators.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-neutral-800">{g.name ?? "Generator"}</span>
                      <span className="rounded-md bg-neutral-100 px-1.5 py-0.5 font-mono text-[11px] text-neutral-600">{g.tagNo}</span>
                    </li>
                  ))}
                </ul>
              )}
              {can("diesel") && (
                <Button className="mt-5 w-full" icon={Fuel} onClick={() => setDialog({ kind: "diesel" })}>
                  Record diesel
                </Button>
              )}
            </Panel>
            <Panel title="Tank level" subtitle="Litres in the tank after each entry in the log." icon={Fuel} hue="coral">
              {levels.length < 2 ? (
                <p className="py-10 text-center text-sm text-neutral-500">Record a few deliveries and draw-downs to see the level over time.</p>
              ) : (
                <MultiLine
                  labels={levels.map((l) => day(l.date).replace(/ \d{4}$/, ""))}
                  series={[{ key: "level", label: "Litres in the tank", hue: "coral", values: levels.map((l) => l.level), area: true }]}
                  format={(v) => litres(v)}
                  caption="Diesel in the tank after each entry"
                />
              )}
              {f.diesel.length > 0 && (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[520px] text-sm">
                    <caption className="sr-only">The diesel log, newest first</caption>
                    <thead>
                      <tr className="border-b border-neutral-100 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                        <th scope="col" className="py-2 pr-3">
                          On
                        </th>
                        <th scope="col" className="py-2 pr-3">
                          Entry
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right">
                          Litres
                        </th>
                        <th scope="col" className="py-2 pr-3 text-right">
                          Cost
                        </th>
                        <th scope="col" className="py-2 text-right">
                          Hours
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.diesel.slice(0, 20).map((e) => (
                        <tr key={e.id} className="border-b border-neutral-50 last:border-0">
                          <td className="py-2.5 pr-3 tabular-nums text-neutral-700">{day(e.enteredOn)}</td>
                          <td className="py-2.5 pr-3">
                            {e.kind === "diesel_in" ? (
                              <Chip hue="mint">Bought in</Chip>
                            ) : (
                              <Chip hue="coral">Used{e.generator ? ` · ${e.generator}` : ""}</Chip>
                            )}
                          </td>
                          <td className={cx("py-2.5 pr-3 text-right font-semibold tabular-nums", e.kind === "diesel_in" ? "text-mint-700" : "text-neutral-900")}>
                            {e.kind === "diesel_in" ? "+" : "−"}
                            {litres(e.litres)}
                          </td>
                          <td className="py-2.5 pr-3 text-right tabular-nums text-neutral-700">{e.amount ? amount(e.amount) : "-"}</td>
                          <td className="py-2.5 text-right tabular-nums text-neutral-700">{e.reading ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          </div>
        )}
      </div>

      {dialog?.kind === "edit" && <FacilityDialog facility={f} kinds={KINDS} onClose={() => setDialog(null)} onDone={() => done("Site saved.")} />}
      {dialog?.kind === "space" && <SpaceDialog facilityId={f.id} space={dialog.space} onClose={() => setDialog(null)} onDone={() => done(dialog.space ? "Room saved." : "Room added.")} />}
      {dialog?.kind === "lease" && (
        <LeaseDialog lease={f.leases.find((l) => l.id === dialog.leaseId)} facilityId={f.id} onClose={() => setDialog(null)} onDone={() => done(dialog.leaseId ? "Lease saved." : "Lease added.")} />
      )}
      {dialog?.kind === "view-lease" &&
        (() => {
          const l = f.leases.find((x) => x.id === dialog.leaseId);
          return l ? <LeaseDrawer lease={l} onClose={() => setDialog(null)} onEdit={can("update_lease") ? () => setDialog({ kind: "lease", leaseId: l.id }) : undefined} /> : null;
        })()}
      {dialog?.kind === "utility" && <UtilityDialog facilityId={f.id} utility={dialog.utility} onClose={() => setDialog(null)} onDone={() => done("Utility account saved.")} />}
      {dialog?.kind === "bill" && <BillDialog utility={dialog.utility} onClose={() => setDialog(null)} onDone={() => done("Bill added.")} />}
      {dialog?.kind === "diesel" && <DieselDialog facility={f} tank={f.tank} generators={f.generators} onClose={() => setDialog(null)} onDone={() => done("Diesel recorded.")} />}
    </div>
  );
}

function UtilityCard({ u, onBill, onEdit }: { u: UtilityAccount; onBill?: () => void; onEdit?: () => void }) {
  const k = spendKind(u.kind);
  const asc = [...u.bills].sort((a, b) => a.month.localeCompare(b.month));
  const latest = asc[asc.length - 1];
  return (
    <div className={cx("flex h-full flex-col gap-4 rounded-2xl border border-neutral-200/80 p-4", !u.active && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span className={cx("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", HUE[k.hue].soft)}>
          <k.icon size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">{u.kindLabel}</p>
          <p className="truncate text-xs text-neutral-500">
            {u.provider && (
              <>
                <CounterpartyLink id={u.providerId} name={u.provider} />
                {" · "}
              </>
            )}
            {[u.accountNo, u.billing === "prepaid" ? "Prepaid" : "Postpaid"].filter(Boolean).join(" · ")}
          </p>
        </div>
        {onEdit && (
          <Button size="sm" variant="ghost" icon={PenLine} aria-label={`Edit the ${u.kindLabel.toLowerCase()} account`} onClick={onEdit}>
            <span className="sr-only">Edit</span>
          </Button>
        )}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-neutral-500">{latest ? `Last bill, ${monthLabel(latest.month)}` : "No bills yet"}</p>
          <p className="text-xl font-bold tabular-nums text-neutral-900">{latest ? compact(latest.amount) : "-"}</p>
          {latest?.units != null && (
            <p className="text-xs text-neutral-500">
              {latest.units.toLocaleString("en-NG")} {u.unit ?? "units"}
            </p>
          )}
        </div>
        {asc.length > 1 && (
          <Sparkline values={asc.map((b) => b.amount)} hue={k.hue} width={120} height={36} label={`${u.kindLabel} bills, ${monthAbbr(asc[0].month)} to ${monthAbbr(latest.month)}`} />
        )}
      </div>
      {asc.length > 0 && (
        <ol className="flex gap-1" aria-label="Bills by month">
          {asc.slice(-12).map((b) => (
            <li key={b.month} className="flex-1" title={`${monthLabel(b.month)}: ${amount(b.amount)}`}>
              <span className="block h-1.5 rounded-full" style={{ opacity: 0.35 + 0.65 * (b.amount / Math.max(...asc.map((x) => x.amount))) }} aria-hidden>
                <span className={cx("block h-full rounded-full", HUE[k.hue].bar)} />
              </span>
              <span className="sr-only">
                {monthLabel(b.month)}: {amount(b.amount)}
              </span>
            </li>
          ))}
        </ol>
      )}
      {onBill && (
        <Button size="sm" className="mt-auto self-start" icon={Receipt} onClick={onBill}>
          Add a bill
        </Button>
      )}
    </div>
  );
}
