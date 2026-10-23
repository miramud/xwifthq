"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, Check, CircleAlert, Clock, Download, Handshake, Hourglass, PenLine, Plus, Star, X } from "lucide-react";
import { Button, Chip, Empty, PageHeader, StatGrid, cx } from "@/components/workspace/kit";
import { todayYmd } from "@/components/workspace/Calendar";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { DetailDrawer, DetailList } from "@/components/workspace/DetailDrawer";
import { BackLink, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { amount, day, monthLabel } from "@/suite/finance/lib/format";
import { useAuth } from "@/lib/auth-store";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { facilities, opsError, type ContractFull, type FacilityRow } from "@/lib/api/operations-facilities-client";
import { ConfirmMonthDialog, ContractDialog } from "./FacilityDialogs";
import { ChipFilter, Stars } from "./parts";
import { CounterpartyLink, MemoLink } from "../links";
import { MONTH_STATE, contractMonths, expiryStage, leftText, monthAbbr, type MonthState } from "./labels";
import { RichTextView } from "@/components/workspace/RichTextView";

type Filter = "active" | "to_confirm" | "all";

/**
 * Service contracts, each with a strip of its last twelve months: a month
 * confirmed (and so paid), disputed (and so not), still to confirm, or not
 * yet started. A month to confirm opens the confirm-or-dispute dialog with
 * a rating. The renewal countdown sits beside it.
 */
export default function ContractsBoard() {
  const { user } = useAuth();
  const [contracts, setContracts] = useState<ContractFull[] | null>(null);
  const [services, setServices] = useState<Record<string, string>>({});
  const [sites, setSites] = useState<FacilityRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [filter, setFilter] = useState<Filter>("active");
  const [editing, setEditing] = useState<{ contract?: ContractFull } | null>(null);
  const [confirming, setConfirming] = useState<{ contract: ContractFull; period: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<ContractFull | null>(null);
  const today = todayYmd();

  useEffect(() => {
    let alive = true;
    Promise.all([facilities.contracts(), facilities.list().catch(() => null)]).then(
      ([c, b]) => {
        if (!alive) return;
        setContracts(c.contracts);
        setServices(c.services);
        setSites(b?.facilities ?? []);
        setError(null);
      },
      (e: unknown) => alive && setError(`The service contracts didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  const shown = useMemo(
    () =>
      (contracts ?? []).filter((c) => (filter === "all" ? true : filter === "to_confirm" ? c.status === "active" && c.toConfirm.length > 0 : c.status === "active")),
    [contracts, filter],
  );

  if (error && !contracts) {
    return (
      <div>
        <BackLink href="/suite/operations/facilities" label="Facilities" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  }
  if (!contracts) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the service contracts…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const active = contracts.filter((c) => c.status === "active");
  const toConfirm = active.reduce((s, c) => s + c.toConfirm.length, 0);
  const disputed = contracts.reduce((s, c) => s + c.confirmations.filter((x) => x.status === "disputed" && x.period.slice(0, 4) === today.slice(0, 4)).length, 0);
  const rated = contracts.filter((c) => c.rating !== null);
  const avg = rated.length ? Math.round((rated.reduce((s, c) => s + (c.rating ?? 0), 0) / rated.length) * 10) / 10 : null;
  const renewing = active.filter((c) => c.daysLeft <= Math.max(c.renewalNoticeDays ?? 0, 30));
  const canConfirm = mayDoOps(user, "facilities", "confirm");
  const canEdit = mayDoOps(user, "facilities", "update_contract");
  const exportCsv = () =>
    downloadCsv(csvName("service-contracts", filter === "all" ? "" : filter, today), [
      ["Service", "Vendor", "Site", "Reference", "Status", "Starts", "Ends", "Days left", "Frequency", "Currency", "Per period", "Contract value", "Renewal notice days", "Officer", "Average rating", "Months confirmed", "Months disputed", "Months to confirm"],
      ...shown.map((c) => [
        c.serviceLabel,
        c.vendor ?? "",
        c.facility ?? "Every site",
        c.reference ?? "",
        c.status === "active" ? "Active" : c.status === "terminated" ? "Terminated" : "Ended",
        csvDate(c.startsOn),
        csvDate(c.endsOn),
        c.daysLeft,
        c.frequency === "quarterly" ? "Quarterly" : "Monthly",
        "NGN",
        csvAmount(c.periodAmount),
        csvAmount(c.value),
        c.renewalNoticeDays ?? "",
        c.officer ?? "",
        c.rating ?? "",
        c.confirmations.filter((x) => x.status === "confirmed").length,
        c.confirmations.filter((x) => x.status === "disputed").length,
        c.toConfirm.join(" "),
      ]),
    ]);
  const siteOptions = sites.map((s) => ({ value: s.id, label: s.name, hint: s.code }));

  return (
    <div>
      <BackLink href="/suite/operations/facilities" label="Facilities" />
      <PageHeader
        title="Service contracts"
        subtitle="Confirm each month before it is paid. A disputed month pays nothing."
        actions={
          <>
            <Button icon={Download} onClick={exportCsv} disabled={shown.length === 0}>
              Download CSV
            </Button>
            {mayDoOps(user, "facilities", "create_contract") && (
              <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>
                Add a contract
              </Button>
            )}
          </>
        }
      />
      <Notice text={notice} />

      <div className="space-y-5">
        <StatGrid>
          <StatCard featured label="Months to confirm" value={toConfirm} icon={Clock} hint={toConfirm ? "Nothing is paid until they are" : "Every month is confirmed"} />
          <StatCard label="Active contracts" value={active.length} icon={Handshake} hue="mint" hint={`${contracts.length - active.length} ended or terminated`} />
          <StatCard label="Disputed this year" value={disputed} icon={CircleAlert} hue={disputed ? "rose" : "slate"} hint={disputed ? "Months not paid" : "None disputed"} />
          <StatCard label="Average rating" value={avg ?? "-"} unit={avg ? "of 5" : undefined} icon={Star} hue="sun" hint={renewing.length ? `${renewing.length} due for renewal` : "No renewal due"} />
        </StatGrid>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ChipFilter
            label="Which contracts"
            value={filter}
            onChange={setFilter}
            options={[
              { key: "active", label: "Active", count: active.length },
              { key: "to_confirm", label: "With months to confirm", count: active.filter((c) => c.toConfirm.length).length },
              { key: "all", label: "All", count: contracts.length },
            ]}
          />
          <MonthKey />
        </div>

        {shown.length === 0 ? (
          <div className="ws-card">
            <Empty icon={Handshake} hue="mint" title={filter === "to_confirm" ? "Nothing to confirm" : "No service contracts yet"} hint={filter === "to_confirm" ? "Every month that has run is confirmed or disputed." : "Add cleaning, security, AC and the other contracts the sites run on."} />
          </div>
        ) : (
          <ul className="space-y-4">
            {shown.map((c) => (
              <li key={c.id}>
                <ContractCard
                  c={c}
                  today={today}
                  onOpen={() => setOpen(c)}
                  onConfirm={canConfirm && c.status === "active" ? (period) => setConfirming({ contract: c, period }) : undefined}
                  onEdit={canEdit ? () => setEditing({ contract: c }) : undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      {open && <ContractDrawer c={open} onClose={() => setOpen(null)} onEdit={canEdit ? () => setEditing({ contract: open }) : undefined} />}
      {editing && (
        <ContractDialog
          contract={editing.contract}
          services={services}
          sites={siteOptions}
          onClose={() => setEditing(null)}
          onDone={() => {
            setNotice(editing.contract ? "Contract saved." : "Contract added.");
            setEditing(null);
            setReload((n) => n + 1);
          }}
        />
      )}
      {confirming && (
        <ConfirmMonthDialog
          contract={confirming.contract}
          period={confirming.period}
          onClose={() => setConfirming(null)}
          onDone={(c) => {
            const conf = c.confirmations.find((x) => x.period === confirming.period);
            setNotice(conf?.status === "disputed" ? `${monthLabel(confirming.period)} disputed. Nothing is paid for it.` : `${monthLabel(confirming.period)} confirmed. Its payment memo is raised.`);
            setContracts((list) => (list ?? []).map((x) => (x.id === c.id ? c : x)));
            setConfirming(null);
          }}
        />
      )}
    </div>
  );
}

const CELL: Record<MonthState, { cls: string; icon?: typeof Check }> = {
  confirmed: { cls: "bg-mint-500 text-white", icon: Check },
  disputed: { cls: "bg-rose-500 text-white", icon: X },
  to_confirm: { cls: "bg-sun-50 text-sun-700 ring-1 ring-inset ring-sun-400", icon: BellRing },
  running: { cls: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200" },
  not_started: { cls: "ws-hatch text-neutral-400" },
  ended: { cls: "ws-hatch text-neutral-400" },
};

function MonthKey() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600" aria-label="Key">
      {(["confirmed", "disputed", "to_confirm", "not_started"] as MonthState[]).map((s) => {
        const Icon = CELL[s].icon;
        return (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span className={cx("flex h-4 w-4 items-center justify-center rounded", CELL[s].cls)} aria-hidden>
              {Icon && <Icon size={10} strokeWidth={3} />}
            </span>
            {MONTH_STATE[s].label}
          </li>
        );
      })}
    </ul>
  );
}

function ContractCard({ c, today, onOpen, onConfirm, onEdit }: { c: ContractFull; today: string; onOpen?: () => void; onConfirm?: (period: string) => void; onEdit?: () => void }) {
  const months = contractMonths(c, today);
  const st = expiryStage(c.daysLeft);
  const noticeIn = c.renewalNoticeDays ? c.daysLeft - c.renewalNoticeDays : null;
  return (
    <article className="ws-card space-y-4 p-5" aria-label={`${c.serviceLabel}, ${c.vendor ?? "vendor"}`}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-neutral-900">
              {onOpen ? (
                <button type="button" onClick={onOpen} className="rounded text-left outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300" aria-label={`Open the ${c.serviceLabel.toLowerCase()} contract details`}>
                  {c.serviceLabel}
                </button>
              ) : (
                c.serviceLabel
              )}
            </h3>
            {c.toConfirm.length > 0 && c.status === "active" && <Chip hue="sun">{c.toConfirm.length} to confirm</Chip>}
          </div>
          <p className="text-xs text-neutral-500">
            <CounterpartyLink id={c.vendorId} name={c.vendor} fallback="Vendor not recorded" />
            {[c.facility ?? "Every site", c.reference, c.officer ? `Officer: ${c.officer}` : null].filter(Boolean).map((t) => ` · ${t}`).join("")}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Stars value={c.rating} />
          {onEdit && (
            <Button size="sm" variant="ghost" icon={PenLine} onClick={onEdit} aria-label={`Edit the ${c.serviceLabel.toLowerCase()} contract`}>
              Edit
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <ol className="grid grid-cols-6 gap-1.5 sm:grid-cols-12" aria-label={`${c.serviceLabel}: the last twelve months`}>
          {months.map((m) => {
            const meta = CELL[m.state];
            const Icon = meta.icon;
            const conf = c.confirmations.find((x) => x.period === m.month);
            const say = `${monthLabel(m.month)}: ${MONTH_STATE[m.state].label.toLowerCase()}${conf?.rating ? `, rated ${conf.rating} of 5` : ""}${conf?.notes ? `. ${conf.notes}` : ""}`;
            const body = (
              <>
                <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{monthAbbr(m.month)}</span>
                <span className="flex h-4 items-center justify-center">{Icon && <Icon size={13} strokeWidth={2.5} aria-hidden />}</span>
              </>
            );
            const cls = cx("flex h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl", meta.cls);
            return (
              <li key={m.month}>
                {m.state === "to_confirm" && onConfirm ? (
                  <button
                    type="button"
                    onClick={() => onConfirm(m.month)}
                    aria-label={`Confirm or dispute ${monthLabel(m.month)}`}
                    title={say}
                    className={cx(cls, "cursor-pointer outline-none transition hover:bg-sun-100 focus-visible:ring-2 focus-visible:ring-primary-300")}
                  >
                    {body}
                  </button>
                ) : (
                  <span className={cls} title={say} role="img" aria-label={say}>
                    {body}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
        <dl className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-1">
          <div className="rounded-2xl bg-neutral-50 px-3.5 py-2.5">
            <dt className="text-xs text-neutral-500">Paid each {c.frequency === "quarterly" ? "quarter" : "month"}</dt>
            <dd className="font-semibold tabular-nums text-neutral-900">{amount(c.periodAmount)}</dd>
          </div>
          <div className={cx("rounded-2xl px-3.5 py-2.5", c.status === "active" && c.daysLeft <= 120 ? "bg-coral-50" : "bg-neutral-50")}>
            <dt className="flex items-center gap-1 text-xs text-neutral-500">
              <Hourglass size={12} aria-hidden /> Ends {day(c.endsOn)}
            </dt>
            <dd className="flex flex-wrap items-center gap-1.5 font-semibold text-neutral-900">
              {c.status === "active" ? <Chip hue={st.hue}>{leftText(c.daysLeft)}</Chip> : <Chip>{c.status === "terminated" ? "Terminated" : "Ended"}</Chip>}
            </dd>
            {c.status === "active" && noticeIn !== null && (
              <dd className={cx("mt-1 text-xs", noticeIn <= 0 ? "font-semibold text-rose-700" : "text-neutral-500")}>
                {noticeIn <= 0 ? "Renewal notice is due now" : `Renewal notice in ${noticeIn} days`}
              </dd>
            )}
          </div>
        </dl>
      </div>
    </article>
  );
}

/** A contract read in full: its terms, scope and SLA, and every month confirmed or disputed with its payment memo. */
function ContractDrawer({ c, onClose, onEdit }: { c: ContractFull; onClose: () => void; onEdit?: () => void }) {
  const st = expiryStage(c.daysLeft);
  const per = c.frequency === "quarterly" ? "quarter" : "month";
  return (
    <DetailDrawer
      title={`${c.serviceLabel} contract`}
      subtitle={[c.vendor, c.reference].filter(Boolean).join(" · ")}
      icon={Handshake}
      hue="mint"
      onClose={onClose}
      onEdit={onEdit}
      editLabel="Edit the contract"
      status={
        <>
          {c.status === "active" ? <Chip hue={st.hue}>{leftText(c.daysLeft)}</Chip> : <Chip>{c.status === "terminated" ? "Terminated" : "Ended"}</Chip>}
          {c.toConfirm.length > 0 && c.status === "active" && <Chip hue="sun">{c.toConfirm.length} to confirm</Chip>}
        </>
      }
      facts={[
        { label: "Service", value: c.serviceLabel },
        { label: "Vendor", value: c.vendor ? <CounterpartyLink id={c.vendorId} name={c.vendor} /> : null },
        { label: "Site", value: c.facility ?? "Every site" },
        { label: "Reference", value: c.reference },
        { label: "Starts", value: day(c.startsOn) },
        { label: "Ends", value: day(c.endsOn) },
        { label: `Paid each ${per}`, value: amount(c.periodAmount) },
        { label: "Contract value", value: c.value ? amount(c.value) : null },
        { label: "Renewal notice", value: c.renewalNoticeDays ? `${c.renewalNoticeDays} days` : null },
        { label: "Officer", value: c.officer },
        { label: "Average rating", value: c.rating !== null ? `${c.rating} of 5` : "Not rated yet" },
        { label: "Months to confirm", value: c.toConfirm.length ? c.toConfirm.map((m) => monthLabel(m)).join(", ") : "None" },
        { label: "Scope", value: c.scope ? <RichTextView value={c.scope} size="sm" /> : null, wide: true },
        { label: "Service levels", value: c.sla, wide: true },
      ]}
      sections={[
        {
          title: "Months confirmed or disputed",
          empty: "No month has been confirmed yet.",
          children:
            c.confirmations.length > 0 ? (
              <DetailList
                rows={c.confirmations.map((x) => ({
                  key: x.period,
                  main: (
                    <>
                      {monthLabel(x.period)}
                      {x.memoId && (
                        <>
                          {" · "}
                          <MemoLink id={x.memoId} reference="Payment memo" />
                        </>
                      )}
                    </>
                  ),
                  sub: [x.rating ? `Rated ${x.rating} of 5` : null, x.by ? `By ${x.by}` : null, x.notes].filter(Boolean).join(" · ") || undefined,
                  aside: (
                    <span className="flex flex-col items-end gap-1">
                      <span className="font-semibold text-neutral-900">{x.amount ? amount(x.amount) : "-"}</span>
                      <Chip hue={MONTH_STATE[x.status].hue}>{x.status === "confirmed" ? "Confirmed" : "Disputed"}</Chip>
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
