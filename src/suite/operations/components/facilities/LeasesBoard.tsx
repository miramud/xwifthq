"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Download, FileSignature, Hourglass, Plus, Wallet } from "lucide-react";
import { Button, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { hueHex } from "@/components/workspace/charts";
import { todayYmd } from "@/components/workspace/Calendar";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { BackLink, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { amount, compact, day } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { facilities, opsError, type FacilityRow, type Lease } from "@/lib/api/operations-facilities-client";
import { LeaseDialog } from "./FacilityDialogs";
import { LeaseCard, LeaseDrawer } from "./LeaseParts";
import { ChipFilter } from "./parts";
import { EXPIRY_MARKERS, LEASE_FREQUENCIES, addDaysYmd, addMonthsYmd, expiryStage, leftText, monthTicks, percentAt, type Window } from "./labels";

type Filter = "active" | "soon" | "all";

/**
 * Every lease on one expiry timeline: each a bar from the day it starts to
 * the day it ends, with the T−120, T−90 and T−30 notice markers before the
 * end and today across them all, so the next renewal to work on is the one
 * whose markers today has already passed. Each lease's rent schedule below.
 */
export default function LeasesBoard() {
  const { user } = useAuth();
  const [leases, setLeases] = useState<Lease[] | null>(null);
  const [sites, setSites] = useState<FacilityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<{ lease?: Lease } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<Lease | null>(null);
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    Promise.all([facilities.leases(), facilities.list().catch(() => null)]).then(
      ([l, b]) => {
        if (!alive) return;
        setLeases(l);
        setSites(b?.facilities ?? []);
        setError(null);
      },
      (e: unknown) => alive && setError(`The leases didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const shown = useMemo(
    () =>
      (leases ?? [])
        .filter((l) => (filter === "all" ? true : filter === "soon" ? l.status === "active" && l.daysLeft <= 120 : l.status === "active"))
        .sort((a, b) => a.endsOn.localeCompare(b.endsOn)),
    [leases, filter],
  );

  if (error && !leases) {
    return (
      <div>
        <BackLink href="/suite/operations/facilities" label="Facilities" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!leases) {
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the leases…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[280px]" />
      </div>
    );
  }

  const active = leases.filter((l) => l.status === "active");
  const soon = active.filter((l) => l.daysLeft <= 120);
  const nextDue = active.filter((l) => l.nextDueOn).sort((a, b) => (a.nextDueOn ?? "").localeCompare(b.nextDueOn ?? ""))[0];
  const yearRent = active.reduce((s, l) => s + annualRent(l), 0);
  const can = mayDoOps(user, "facilities", "create_lease");
  const canEdit = mayDoOps(user, "facilities", "update_lease");

  /* The leases listed under the filter, as a spreadsheet opens them. */
  const exportCsv = () =>
    downloadCsv(csvName("leases", filter === "all" ? "" : filter, today), [
      ["Site", "Landlord", "Reference", "Status", "Starts", "Ends", "Days left", "Frequency", "Currency", "Rent", "Service charge", "Escalation %", "Escalation every (months)", "Notice days", "Next due", "Next amount", "Payments raised", "Notes"],
      ...shown.map((l) => [
        l.facility ?? "",
        l.landlord ?? "",
        l.reference ?? "",
        l.status === "ended" ? "Ended" : "Active",
        csvDate(l.startsOn),
        csvDate(l.endsOn),
        l.daysLeft,
        LEASE_FREQUENCIES[l.frequency]?.label ?? l.frequency,
        "NGN",
        csvAmount(l.rent),
        csvAmount(l.serviceCharge ?? 0),
        l.escalationBp ? (l.escalationBp / 100).toFixed(2) : "",
        l.escalationEveryMonths ?? "",
        l.noticeDays ?? "",
        csvDate(l.nextDueOn),
        csvAmount(l.nextAmount),
        l.payments.length,
        l.notes ?? "",
      ]),
    ]);

  return (
    <div>
      <BackLink href="/suite/operations/facilities" label="Facilities" />
      <PageHeader
        title="Leases"
        subtitle="Every rented site: when each lease ends, when notice is due, and the rent it will run."
        actions={
          <>
            <Button icon={Download} onClick={exportCsv} disabled={shown.length === 0}>
              Download CSV
            </Button>
            {can && (
              <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>
                Add a lease
              </Button>
            )}
          </>
        }
      />
      <Notice text={notice} />

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Active leases" value={active.length} icon={FileSignature} hint={`${leases.length - active.length} ended`} />
          <StatCard label="Ending within 120 days" value={soon.length} icon={Hourglass} hue={soon.length ? "coral" : "mint"} hint={soon.length ? "Renew or give notice" : "Nothing to act on yet"} />
          <StatCard
            label="Next instalment"
            value={nextDue?.nextAmount != null ? compact(nextDue.nextAmount) : "-"}
            icon={CalendarClock}
            hue="blue"
            hint={nextDue?.nextDueOn ? `${nextDue.facility ?? "A site"}, due ${day(nextDue.nextDueOn)}` : "No instalment to come"}
          />
          <StatCard label="Rent a year" value={compact(yearRent)} icon={Wallet} hue="grape" hint="Current instalments, annualised" />
        </StatGrid>

        <Panel title="Expiry timeline" subtitle="Bars run from start to end. Dashed marks are 120, 90 and 30 days before the end." icon={Hourglass} hue="sun">
          <div className="mb-4">
            <ChipFilter
              label="Which leases"
              value={filter}
              onChange={setFilter}
              options={[
                { key: "active", label: "Active", count: active.length },
                { key: "soon", label: "Ending soon", count: soon.length },
                { key: "all", label: "All", count: leases.length },
              ]}
            />
          </div>
          {shown.length === 0 ? (
            <Empty icon={FileSignature} hue="sun" title={filter === "soon" ? "Nothing ends in the next 120 days" : "No leases yet"} hint={filter === "soon" ? undefined : "Add the leases on the sites you rent."} />
          ) : (
            <ExpiryTimeline leases={shown} today={today} />
          )}
        </Panel>

        <section aria-labelledby="schedules-h" className="space-y-4">
          <div>
            <h2 id="schedules-h" className="text-base font-bold tracking-tight text-neutral-900">
              Rent schedules
            </h2>
            <p className="text-xs text-neutral-500">The next instalment with escalation applied, and the payments you have asked Finance for.</p>
          </div>
          {shown.map((l) => (
            <LeaseCard key={l.id} lease={l} today={today} showSite onOpen={() => setOpen(l)} onEdit={canEdit ? () => setEditing({ lease: l }) : undefined} />
          ))}
        </section>
      </div>

      {open && <LeaseDrawer lease={open} onClose={() => setOpen(null)} onEdit={canEdit ? () => setEditing({ lease: open }) : undefined} />}
      {editing && (
        <LeaseDialog
          lease={editing.lease}
          sites={sites.map((s) => ({ value: s.id, label: s.name, hint: s.code }))}
          onClose={() => setEditing(null)}
          onDone={() => {
            setNotice(editing.lease ? "Lease saved." : "Lease added.");
            setEditing(null);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

const PER_YEAR: Record<string, number> = { monthly: 12, quarterly: 4, biannual: 2, annual: 1 };

function annualRent(l: Lease): number {
  return (l.nextAmount ?? l.rent + (l.serviceCharge ?? 0)) * (PER_YEAR[l.frequency] ?? 1);
}

/** All the leases against one axis, today across them. */
export function ExpiryTimeline({ leases, today }: { leases: Lease[]; today: string }) {
  const from = [today, ...leases.map((l) => l.startsOn)].sort()[0];
  const lastEnd = [...leases.map((l) => l.endsOn)].sort().reverse()[0] ?? today;
  // Not more than a year of history, so the ends stay readable.
  const w: Window = { from: from < addMonthsYmd(today, -12) ? addMonthsYmd(today, -12) : addMonthsYmd(from, -1), to: addMonthsYmd(lastEnd > today ? lastEnd : today, 2) };
  const ticks = monthTicks(w, 8);
  const todayAt = percentAt(today, w);

  return (
    <figure className="space-y-3">
      <div className="hidden grid-cols-[13rem_minmax(0,1fr)] gap-4 sm:grid" aria-hidden>
        <span />
        <div className="relative h-10 text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
          {ticks.map((t) => (
            <span key={t.date} className="absolute bottom-0 -translate-x-1/2 whitespace-nowrap tabular-nums" style={{ left: `${percentAt(t.date, w)}%` }}>
              {t.label}
            </span>
          ))}
        </div>
      </div>
      <ul className="relative space-y-3">
        {leases.map((l) => {
          const st = l.status === "ended" ? { label: "Ended", hue: "slate" as const } : expiryStage(l.daysLeft);
          const a = percentAt(l.startsOn, w);
          const b = percentAt(l.endsOn, w);
          return (
            <li key={l.id} className="grid gap-1.5 sm:grid-cols-[13rem_minmax(0,1fr)] sm:items-center sm:gap-4">
              <Link href={`/suite/operations/facilities/${l.facilityId}`} className="min-w-0 rounded-lg outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                <span className="block truncate text-sm font-semibold text-neutral-900">{l.facility ?? "Site"}</span>
                <span className="block truncate text-xs text-neutral-500">{l.landlord ?? l.reference ?? "-"}</span>
              </Link>
              <div
                role="img"
                aria-label={`${l.facility ?? "Lease"}: ${day(l.startsOn)} to ${day(l.endsOn)}, ${leftText(l.daysLeft).toLowerCase()}${l.nextDueOn ? `, next rent ${amount(l.nextAmount)} on ${day(l.nextDueOn)}` : ""}`}
                className="relative h-8 rounded-xl bg-neutral-50"
              >
                <span className="absolute inset-y-1.5 rounded-md" style={{ left: `${a}%`, width: `${Math.max(0.5, b - a)}%`, background: `${hueHex(st.hue)}33`, boxShadow: `inset 0 0 0 1px ${hueHex(st.hue)}66` }} />
                {EXPIRY_MARKERS.map((d) => {
                  const at = percentAt(addDaysYmd(l.endsOn, -d), w);
                  const passed = today >= addDaysYmd(l.endsOn, -d);
                  return at > a ? (
                    <span
                      key={d}
                      className={cx("absolute inset-y-0.5 w-0 border-l-2", passed ? "border-solid" : "border-dashed")}
                      style={{ left: `${at}%`, borderColor: hueHex(d === 30 ? "rose" : d === 90 ? "coral" : "sun") }}
                      title={`T−${d}: ${day(addDaysYmd(l.endsOn, -d))}`}
                    />
                  ) : null;
                })}
                <span className="absolute inset-y-0 w-[3px] -translate-x-1/2 rounded-full" style={{ left: `${b}%`, background: hueHex(st.hue) }} />
                <span className={cx("absolute top-1/2 -translate-y-1/2 whitespace-nowrap px-2", b > 75 ? "-translate-x-full" : "")} style={{ left: `${b}%` }}>
                  <Chip hue={st.hue}>{l.status === "ended" ? "Ended" : leftText(l.daysLeft)}</Chip>
                </span>
              </div>
            </li>
          );
        })}
        <li aria-hidden className="pointer-events-none absolute inset-y-0 right-0 hidden sm:left-[calc(13rem+1rem)] sm:block">
          <span className="absolute inset-y-[-0.5rem] w-0 border-l-2 border-dashed border-primary-500" style={{ left: `${todayAt}%` }} />
          <span className="absolute -top-9 -translate-x-1/2 rounded-full bg-primary-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white" style={{ left: `${todayAt}%` }}>
            Today
          </span>
        </li>
      </ul>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 pt-2 text-xs text-neutral-600">
        {EXPIRY_MARKERS.map((d) => (
          <span key={d} className="inline-flex items-center gap-1.5">
            <span className="h-3 w-0 border-l-2 border-dashed" style={{ borderColor: hueHex(d === 30 ? "rose" : d === 90 ? "coral" : "sun") }} aria-hidden />
            T−{d} days
          </span>
        ))}
        <span className="text-neutral-500">A solid mark has passed.</span>
      </figcaption>
    </figure>
  );
}
