"use client";

import { ArrowUpRight, CalendarClock, FileSignature, PenLine, Receipt, TrendingUp } from "lucide-react";
import { Button, Chip, cx } from "@/components/workspace/kit";
import { DetailDrawer, DetailList } from "@/components/workspace/DetailDrawer";
import { hueHex } from "@/components/workspace/charts";
import { amount, compact, day } from "@/suite/finance/lib/format";
import type { Lease } from "@/lib/api/operations-facilities-client";
import { EXPIRY_MARKERS, LEASE_FREQUENCIES, addDaysYmd, expiryStage, leftText, percentAt, rentSchedule, shortMonth, type Window } from "./labels";
import { MemoChip } from "./parts";
import { CounterpartyLink, MemoLink } from "../links";

/**
 * The rent a lease runs, on a line from the day it starts to the day it ends:
 * each instalment a mark (filled once its memo is raised, hollow while it is
 * still to come, bigger where the rent steps up), today as a dashed rule, and
 * the notice markers before the end. The next instalment is called out.
 */
export function RentTimeline({ lease, today }: { lease: Lease; today: string }) {
  const sched = rentSchedule(lease);
  const w: Window = { from: lease.startsOn, to: lease.endsOn };
  const todayAt = percentAt(today, w);
  const inTerm = today >= lease.startsOn && today <= lease.endsOn;
  const notice = lease.noticeDays ? addDaysYmd(lease.endsOn, -lease.noticeDays) : null;
  const say = `Rent schedule from ${day(lease.startsOn)} to ${day(lease.endsOn)}: ${sched.length} instalments, ${sched.filter((s) => s.state === "raised").length} raised.`;

  return (
    <figure className="space-y-2">
      <div role="img" aria-label={say} className="relative h-16">
        {/* The term. */}
        <span className="absolute inset-x-0 top-7 h-2 rounded-full bg-neutral-100" aria-hidden />
        <span className="absolute left-0 top-7 h-2 rounded-l-full" style={{ width: `${todayAt}%`, background: `${hueHex("blue")}33` }} aria-hidden />
        {/* Notice markers before the end. */}
        {EXPIRY_MARKERS.map((d) => {
          const at = percentAt(addDaysYmd(lease.endsOn, -d), w);
          return at > 0 ? (
            <span key={d} className="absolute top-4 h-8 w-0 border-l border-dashed border-sun-500" style={{ left: `${at}%` }} aria-hidden>
              <span className="absolute -top-4 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-sun-700">T−{d}</span>
            </span>
          ) : null;
        })}
        {notice && percentAt(notice, w) > 0 && (
          <span className="absolute top-3 h-10 w-[2px] -translate-x-1/2 rounded-full bg-rose-500" style={{ left: `${percentAt(notice, w)}%` }} title={`Notice by ${day(notice)}`} aria-hidden />
        )}
        {sched.map((s) => {
          const at = percentAt(s.dueOn, w);
          const next = s.dueOn === lease.nextDueOn;
          const size = s.stepUp || next ? 14 : 10;
          return (
            <span
              key={s.dueOn}
              title={`${day(s.dueOn)}: ${amount(s.amount)}${s.state === "raised" ? ` (${s.memoStatus ?? "memo raised"})` : ""}`}
              className={cx("absolute -translate-x-1/2 rounded-full border-2", next && "ring-4 ring-primary-100")}
              style={{
                left: `${at}%`,
                top: 32 - size / 2,
                width: size,
                height: size,
                borderColor: hueHex(s.stepUp ? "coral" : "blue"),
                background: s.state === "raised" ? hueHex(s.memoStatus === "paid" ? "mint" : "blue") : "white",
              }}
              aria-hidden
            />
          );
        })}
        {inTerm && (
          <span className="absolute top-1 bottom-0 w-0 border-l-2 border-dashed border-primary-500" style={{ left: `${todayAt}%` }} aria-hidden>
            <span className="absolute -top-1 left-1 whitespace-nowrap rounded-full bg-primary-600 px-1.5 text-[9px] font-bold uppercase leading-4 text-white">Today</span>
          </span>
        )}
      </div>
      <div className="flex justify-between text-[11px] font-medium tabular-nums text-neutral-500" aria-hidden>
        <span>{shortMonth(lease.startsOn)}</span>
        <span>{shortMonth(lease.endsOn)}</span>
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
        <Key fill={hueHex("mint")} label="Paid" />
        <Key fill={hueHex("blue")} label="Memo raised" />
        <Key ring={hueHex("blue")} label="To come" />
        <Key ring={hueHex("coral")} label="Rent steps up" />
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-0 border-l border-dashed border-sun-500" aria-hidden /> Notice markers
        </span>
        {notice && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-[2px] rounded-full bg-rose-500" aria-hidden /> Give notice by {day(notice)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function Key({ fill, ring, label }: { fill?: string; ring?: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full border-2" style={{ background: fill ?? "white", borderColor: ring ?? fill }} aria-hidden />
      {label}
    </span>
  );
}

/** A lease in full: the term, the next instalment, the schedule, and the payments raised. */
export function LeaseCard({ lease, today, onEdit, onOpen, showSite = false }: { lease: Lease; today: string; onEdit?: () => void; onOpen?: () => void; showSite?: boolean }) {
  const stage = expiryStage(lease.daysLeft);
  const base = lease.rent + (lease.serviceCharge ?? 0);
  const escalated = lease.nextAmount !== null && lease.nextAmount > base;
  const title = `${showSite && lease.facility ? `${lease.facility} · ` : ""}${lease.landlord ?? "Landlord not recorded"}`;
  return (
    <article className="ws-card space-y-5 p-5" aria-label={`Lease ${lease.reference ?? ""} ${lease.facility ?? ""}`.trim()}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold tracking-tight text-neutral-900">
            {onOpen ? (
              <button type="button" onClick={onOpen} className="rounded text-left outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300" aria-label={`Open the lease details: ${title}`}>
                {title}
              </button>
            ) : (
              title
            )}
          </p>
          <p className="text-xs text-neutral-500">
            {[lease.reference, `${day(lease.startsOn)} to ${day(lease.endsOn)}`, `${LEASE_FREQUENCIES[lease.frequency]?.label ?? lease.frequency} rent`].filter(Boolean).join(" · ")}
            {lease.landlordId && lease.landlord && (
              <>
                {" · Landlord: "}
                <CounterpartyLink id={lease.landlordId} name={lease.landlord} />
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lease.status === "ended" ? <Chip>Ended</Chip> : <Chip hue={stage.hue}>{leftText(lease.daysLeft)}</Chip>}
          {onEdit && (
            <Button size="sm" variant="ghost" icon={PenLine} onClick={onEdit} aria-label="Edit the lease">
              Edit
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-primary-50/60 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-primary-700">
            <CalendarClock size={13} aria-hidden /> Next instalment
          </p>
          {lease.nextDueOn && lease.nextAmount !== null ? (
            <>
              <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{amount(lease.nextAmount)}</p>
              <p className="text-xs text-neutral-600">Due {day(lease.nextDueOn)}</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-neutral-600">None left in the term</p>
          )}
        </div>
        <div className="rounded-2xl bg-neutral-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Receipt size={13} aria-hidden /> Base rent
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{compact(lease.rent)}</p>
          <p className="text-xs text-neutral-600">{lease.serviceCharge ? `plus ${compact(lease.serviceCharge)} service charge` : "No service charge"}</p>
        </div>
        <div className={cx("rounded-2xl px-4 py-3", escalated ? "bg-coral-50" : "bg-neutral-50")}>
          <p className={cx("flex items-center gap-1.5 text-xs font-medium", escalated ? "text-coral-700" : "text-neutral-500")}>
            <TrendingUp size={13} aria-hidden /> Escalation
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums text-neutral-900">{lease.escalationBp ? `${(lease.escalationBp / 100).toLocaleString("en-NG")}%` : "None"}</p>
          <p className="text-xs text-neutral-600">
            {lease.escalationBp && lease.escalationEveryMonths ? `Every ${lease.escalationEveryMonths} months` : "Flat for the term"}
            {escalated && lease.nextAmount !== null && (
              <span className="ml-1 inline-flex items-center font-semibold text-coral-700">
                <ArrowUpRight size={12} aria-hidden />
                {compact(lease.nextAmount - base)} on the next
              </span>
            )}
          </p>
        </div>
      </div>

      <RentTimeline lease={lease} today={today} />

      {lease.payments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-sm">
            <caption className="sr-only">Rent payments raised for this lease</caption>
            <thead>
              <tr className="bg-neutral-50 text-left text-xs font-semibold text-neutral-500">
                <th scope="col" className="rounded-l-xl px-3 py-2.5">
                  Due
                </th>
                <th scope="col" className="px-3 py-2.5 text-right">
                  Amount
                </th>
                <th scope="col" className="px-3 py-2.5">
                  Memo
                </th>
                <th scope="col" className="rounded-r-xl px-3 py-2.5">
                  Finance
                </th>
              </tr>
            </thead>
            <tbody>
              {lease.payments.map((p) => (
                <tr key={p.dueOn} className="border-b border-neutral-100 last:border-0">
                  <td className="px-3 py-2.5 tabular-nums text-neutral-800">{day(p.dueOn)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-neutral-900">{amount(p.amount)}</td>
                  <td className="px-3 py-2.5 font-mono text-xs text-neutral-600">
                    <MemoLink id={p.memoId} reference={p.memo?.reference} />
                  </td>
                  <td className="px-3 py-2.5">
                    <MemoChip status={p.memo?.status ?? (p.memoId ? "submitted" : null)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {lease.notes && <p className="rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-600">{lease.notes}</p>}
    </article>
  );
}

/** A lease read in full beside the list: every term on record and the rent payments raised. */
export function LeaseDrawer({ lease, onClose, onEdit }: { lease: Lease; onClose: () => void; onEdit?: () => void }) {
  const stage = expiryStage(lease.daysLeft);
  return (
    <DetailDrawer
      title={lease.facility ? `${lease.facility} lease` : "Lease"}
      subtitle={[lease.reference, `${day(lease.startsOn)} to ${day(lease.endsOn)}`].filter(Boolean).join(" · ")}
      icon={FileSignature}
      hue="sun"
      onClose={onClose}
      onEdit={onEdit}
      editLabel="Edit the lease"
      status={lease.status === "ended" ? <Chip>Ended</Chip> : <Chip hue={stage.hue}>{leftText(lease.daysLeft)}</Chip>}
      facts={[
        { label: "Site", value: lease.facility },
        { label: "Landlord", value: lease.landlord ? <CounterpartyLink id={lease.landlordId} name={lease.landlord} /> : null },
        { label: "Reference", value: lease.reference },
        { label: "Status", value: lease.status === "ended" ? "Ended" : "Active" },
        { label: "Starts", value: day(lease.startsOn) },
        { label: "Ends", value: day(lease.endsOn) },
        { label: "Rent per instalment", value: amount(lease.rent) },
        { label: "Paid", value: LEASE_FREQUENCIES[lease.frequency]?.label ?? lease.frequency },
        { label: "Service charge", value: lease.serviceCharge ? amount(lease.serviceCharge) : "None" },
        { label: "Escalation", value: lease.escalationBp ? `${(lease.escalationBp / 100).toLocaleString("en-NG")}%${lease.escalationEveryMonths ? ` every ${lease.escalationEveryMonths} months` : ""}` : "None" },
        { label: "Next instalment", value: lease.nextDueOn && lease.nextAmount !== null ? `${amount(lease.nextAmount)} on ${day(lease.nextDueOn)}` : "None left in the term" },
        { label: "Notice period", value: lease.noticeDays ? `${lease.noticeDays} days` : null },
        { label: "Memo raised", value: lease.memoLeadDays ? `${lease.memoLeadDays} days before due` : null },
        { label: "Lease document", value: lease.documentId ? "On file" : null },
        { label: "Notes", value: lease.notes, wide: true },
      ]}
      sections={[
        {
          title: "Rent payments raised",
          empty: "No payment has been raised for this lease yet.",
          children:
            lease.payments.length > 0 ? (
              <DetailList
                rows={lease.payments.map((p) => ({
                  key: p.dueOn,
                  main: (
                    <>
                      Due {day(p.dueOn)} · <MemoLink id={p.memoId} reference={p.memo?.reference} />
                    </>
                  ),
                  sub: p.memo ? `Paid ${amount(p.memo.paid)} of ${amount(p.memo.amount)}` : undefined,
                  aside: (
                    <span className="flex flex-col items-end gap-1">
                      <span className="font-semibold text-neutral-900">{amount(p.amount)}</span>
                      <MemoChip status={p.memo?.status ?? (p.memoId ? "submitted" : null)} />
                    </span>
                  ),
                }))}
              />
            ) : null,
        },
      ]}
    />
  );
}
