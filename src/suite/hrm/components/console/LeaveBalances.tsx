"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, History, Scale, SlidersHorizontal, UserSearch } from "lucide-react";
import {
  hrm,
  type Employee,
  type LeaveBalance,
} from "@/lib/api/hrm-client";
import { Button, Card, Chip, Empty, Panel, PersonAvatar } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { hueFor } from "@/components/workspace/modules";
import { formatDate, formatDays } from "@/suite/hrm/lib/format";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { useSubmit } from "./Dialog";
import { peopleOptions } from "./CaseWorkflow";
import {
  LoadFailed,
  ModalFrame,
  Notice,
  Skeleton,
  StackBar,
  ToneChip,
  inputCls,
} from "../ui2/kit";
import { FormButtons, FormField, SectionHead } from "../ui2/leave-form";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * What one person actually has left, and the ability to correct it.
 *
 * Both endpoints existed from the day leave did and neither had a screen, so
 * an institution could approve leave against a balance nobody could look up
 * and had no way to put right a figure that was wrong. In practice that means
 * balances get argued about in email and settled by whoever is most insistent.
 *
 * The breakdown is shown in full rather than as one "remaining" number,
 * because every dispute about a balance is a dispute about one of its parts:
 * what they were entitled to, what carried over, what was adjusted, what they
 * have booked but not yet taken.
 */
export default function LeaveBalances() {
  const [people, setPeople] = useState<Employee[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [balances, setBalances] = useState<LeaveBalance[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState<LeaveBalance | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    /*
      100, not 200: the API caps `perPage` at 100 and answers 422 above it,
      which left this picker silently empty.
    */
    hrm.employees
      .list({ perPage: 100 })
      .then((result) => {
        if (!cancelled) setPeople(result.data);
      })
      .catch(() => {
        /* The picker degrades to empty; the page still explains itself. */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    /*
      Nothing to fetch and nothing to clear: with no employee chosen the
      balances card is not rendered at all, so there is no stale list to blank
      and no reason to call setState from an effect body.
    */
    if (employeeId === "") return;

    let cancelled = false;

    hrm.leave
      .balances(employeeId, year)
      .then((result) => {
        if (cancelled) return;
        setBalances(result.data);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [employeeId, year, reloadKey]);

  const thisYear = new Date().getFullYear();
  const person = useMemo(() => people.find((p) => p.id === employeeId) ?? null, [people, employeeId]);

  const adjustButton = (b: LeaveBalance) =>
    b.tracksBalance ? (
      <Button size="sm" icon={SlidersHorizontal} onClick={() => setAdjusting(b)} aria-label={`Adjust ${b.name}`}>
        Adjust
      </Button>
    ) : null;

  const flags = (b: LeaveBalance) => (
    <div className="flex flex-wrap gap-1.5">
      {!b.isPaid && <ToneChip tone="warning">Unpaid</ToneChip>}
      {/*
        Lapsed carry-over is said out loud. Somebody who thinks they are
        carrying five days into March and is not has usually planned a
        holiday around them.
      */}
      {b.carryOverLapsed && <ToneChip tone="warning">Carry-over lapsed</ToneChip>}
    </div>
  );

  const days = (v: number, signed = false) => (
    <span className="tabular-nums">
      {signed && v > 0 ? "+" : ""}
      {formatDays(v)}
    </span>
  );

  const columns: Column<LeaveBalance>[] = [
    {
      key: "name",
      header: "Leave type",
      primary: true,
      sortable: true,
      value: (b) => b.name,
      render: (b) => (
        <div className="flex items-center gap-2.5">
          <Chip hue={hueFor(b.name)} dot>
            {b.code}
          </Chip>
          <span className="font-semibold text-neutral-900">{b.name}</span>
        </div>
      ),
    },
    { key: "entitled", header: "Entitled", align: "right", value: (b) => b.entitledDays, render: (b) => (b.tracksBalance ? days(b.entitledDays) : "—") },
    { key: "accrued", header: "Accrued", align: "right", hideOnMobile: true, value: (b) => b.accruedDays, render: (b) => (b.tracksBalance ? days(b.accruedDays) : "—") },
    { key: "carried", header: "Carried in", align: "right", hideOnMobile: true, value: (b) => b.carriedDays, render: (b) => (b.tracksBalance ? days(b.carriedDays) : "—") },
    { key: "adjusted", header: "Adjusted", align: "right", hideOnMobile: true, value: (b) => b.adjustmentDays, render: (b) => (b.tracksBalance ? days(b.adjustmentDays, true) : "—") },
    { key: "taken", header: "Taken", align: "right", value: (b) => b.takenDays, render: (b) => (b.tracksBalance ? days(b.takenDays) : "—") },
    { key: "booked", header: "Booked", align: "right", value: (b) => b.pendingDays, render: (b) => (b.tracksBalance ? days(b.pendingDays) : "—") },
    {
      key: "left",
      header: "Left",
      align: "right",
      sortable: true,
      value: (b) => (b.tracksBalance ? b.remainingDays : null),
      render: (b) =>
        b.tracksBalance ? (
          <ToneChip tone={b.remainingDays <= 0 ? "neutral" : "success"}>{formatDays(b.remainingDays)} left</ToneChip>
        ) : (
          <span className="text-xs text-neutral-500">Case by case</span>
        ),
    },
    { key: "flags", header: "Notes", hideOnMobile: true, render: flags },
    { key: "actions", header: "", align: "right", tableOnly: true, render: adjustButton },
  ];

  return (
    <div className="space-y-6">
      <Panel
        title="Balances"
        subtitle="What one person has left, and where the figure comes from."
        icon={Scale}
        hue="mint"
      >
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <FormField id="bal-person" label="Whose">
            <SearchableSelect
              id="bal-person"
              value={employeeId}
              onChange={setEmployeeId}
              options={[{ value: "", label: "Choose somebody" }, ...peopleOptions(people)]}
            />
          </FormField>

          <FormField
            id="bal-year"
            label="Leave year"
            hint="Balances are per year, and last year's is still worth looking at during a dispute."
          >
            <SearchableSelect
              id="bal-year"
              aria-describedby="bal-year-hint"
              value={String(year)}
              onChange={(v) => setYear(Number(v))}
              options={[thisYear + 1, thisYear, thisYear - 1, thisYear - 2].map((y) => ({
                value: String(y),
                label: String(y),
              }))}
            />
          </FormField>
        </div>
      </Panel>

      {employeeId === "" && (
        <Card>
          <Empty
            icon={UserSearch}
            hue="mint"
            title="Choose somebody to see their balances"
            hint="Every figure is broken down — entitled, carried, adjusted, taken and booked — so it can be checked."
          />
        </Card>
      )}

      {error !== null && <LoadFailed icon={AlertTriangle} message={error} />}

      {employeeId !== "" && error === null && (
        <section>
          <SectionHead
            title={person ? `${person.person.name ?? "Unnamed"} · ${year}` : `Entitlement ${year}`}
            subtitle={person ? `${person.jobTitle}${person.department ? ` · ${person.department}` : ""}` : undefined}
            actions={person ? <PersonAvatar name={person.person.name} size={36} /> : undefined}
          />
          {balances === null ? (
            <Skeleton className="h-40" />
          ) : (
            <DataView
              rows={balances}
              columns={columns}
              rowKey={(b) => b.typeId}
              storageKey="hrm.leave.balances"
              defaultView="grid"
              searchable={balances.length > 6}
              caption={`Leave balances for ${year}`}
              empty={
                <Empty
                  icon={Scale}
                  title="Nothing to show"
                  hint="This person has no leave types available to them in that year."
                />
              }
              renderCard={(b) => <BalanceCard balance={b} flags={flags(b)} action={adjustButton(b)} />}
              renderListItem={(b) => (
                <div className="flex flex-wrap items-center gap-4 px-5 py-3.5">
                  <Chip hue={hueFor(b.name)} dot>
                    {b.code}
                  </Chip>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-900">{b.name}</p>
                    <p className="truncate text-xs text-neutral-500">
                      {b.tracksBalance
                        ? `${formatDays(b.takenDays)} taken · ${formatDays(b.pendingDays)} booked`
                        : "Granted case by case — there is no balance to run down."}
                    </p>
                  </div>
                  {flags(b)}
                  {b.tracksBalance && (
                    <ToneChip tone={b.remainingDays <= 0 ? "neutral" : "success"}>
                      {formatDays(b.remainingDays)} left
                    </ToneChip>
                  )}
                  {adjustButton(b)}
                </div>
              )}
            />
          )}
        </section>
      )}

      {employeeId !== "" && error === null && balances !== null && <AdjustmentHistory balances={balances} />}

      {adjusting !== null && (
        <AdjustDialog
          employeeId={employeeId}
          balance={adjusting}
          year={year}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

function BalanceCard({
  balance: b,
  flags,
  action,
}: {
  balance: LeaveBalance;
  flags: React.ReactNode;
  action: React.ReactNode;
}) {
  const hue = hueFor(b.name);
  const left = Math.max(0, b.remainingDays);
  return (
    <div className="flex h-full flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Chip hue={hue} dot>
            {b.code}
          </Chip>
          <p className="mt-2 truncate text-[15px] font-semibold text-neutral-900">{b.name}</p>
        </div>
        {b.tracksBalance ? (
          <div className="text-right">
            <p className="text-[28px] font-bold leading-none tracking-tight text-neutral-900 tabular-nums">
              {b.remainingDays}
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">days left</p>
          </div>
        ) : null}
      </div>

      {b.tracksBalance ? (
        <>
          <StackBar
            label={`${b.name} balance`}
            total={b.takenDays + b.pendingDays + left}
            parts={[
              { label: "Taken", value: b.takenDays, hue },
              { label: "Booked", value: b.pendingDays, hue: "sun" },
            ]}
            format={(v) => formatDays(v)}
          />
          {/*
            The whole sum, not just the answer. Every argument about a balance
            is an argument about one of these parts, and a single "remaining"
            figure gives nobody anything to check.
          */}
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-neutral-50 p-3 text-xs">
            <Part label="Entitled" value={b.entitledDays} />
            <Part label="Accrued" value={b.accruedDays} />
            <Part label="Carried in" value={b.carriedDays} />
            <Part label="Adjusted" value={b.adjustmentDays} signed />
          </dl>
        </>
      ) : (
        <p className="text-xs text-neutral-500">Granted case by case — there is no balance to run down.</p>
      )}

      {flags}
      {action && <div className="mt-auto border-t border-neutral-100 pt-3">{action}</div>}
    </div>
  );
}

/**
 * Every manual change to this person's balances this year, newest first (D5).
 *
 * Adjustments add up, so the "Adjusted" figure is a sum — and a sum nobody can
 * take apart is a sum nobody can check. Who, when, how many days and why.
 */
function AdjustmentHistory({ balances }: { balances: LeaveBalance[] }) {
  const rows = balances
    .flatMap((b) => (b.adjustments ?? []).map((a) => ({ ...a, type: b })))
    .sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return (
    <section>
      <SectionHead
        title="Adjustment history"
        icon={History}
        hue="mint"
        subtitle="Each correction adds to the ones before it. The Adjusted figure above is their total."
      />
      {rows.length === 0 ? (
        <Card>
          <Empty icon={History} hue="mint" title="No adjustments this year" hint="Use Adjust on a leave type to give or take back days, with a reason." />
        </Card>
      ) : (
        <Card>
          <ol className="divide-y divide-neutral-100">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-start gap-x-4 gap-y-1.5 px-5 py-3.5">
                <Chip hue={hueFor(r.type.name)} dot>
                  {r.type.code}
                </Chip>
                <span
                  className={`w-16 shrink-0 text-sm font-semibold tabular-nums ${r.days < 0 ? "text-coral-700" : "text-mint-700"}`}
                >
                  {r.days > 0 ? "+" : ""}
                  {formatDays(r.days)}
                </span>
                <RichTextView value={r.note} size="sm" className="min-w-0 flex-1 basis-60 text-neutral-800" />
                <p className="shrink-0 text-xs text-neutral-500">
                  {r.by ?? "Someone"} · {formatDate(r.at)}
                </p>
              </li>
            ))}
          </ol>
        </Card>
      )}
    </section>
  );
}

function Part({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-semibold tabular-nums text-neutral-800">
        {signed && value > 0 ? "+" : ""}
        {formatDays(value)}
      </dd>
    </div>
  );
}

/**
 * Correcting a balance.
 *
 * Signed on purpose: an adjustment is as often a deduction as a gift — leave
 * taken before the system existed, a miscounted carry-over, a day booked
 * outside it. A form that only added would leave HR doing the subtractions by
 * editing somebody's history.
 *
 * The note is required and is the whole point. An unexplained adjustment is
 * indistinguishable from an error six months later, and it is somebody's
 * holiday.
 */
function AdjustDialog({
  employeeId,
  balance,
  year,
  onClose,
  onSaved,
}: {
  employeeId: string;
  balance: LeaveBalance;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [days, setDays] = useState("");
  const [note, setNote] = useState("");
  const { submit, saving, error } = useSubmit(onSaved);

  const parsed = days === "" ? 0 : Number(days);

  return (
    <ModalFrame
      title="Adjust the balance"
      subtitle={`${balance.name} · ${year}`}
      icon={SlidersHorizontal}
      hue="mint"
      onClose={onClose}
      onSubmit={(e) =>
        submit(e, () =>
          hrm.leave.adjust(employeeId, {
            leaveTypeId: balance.typeId,
            days: parsed,
            note,
            year,
          }),
        )
      }
      footer={
        <FormButtons
          onCancel={onClose}
          submitLabel="Adjust"
          busy={saving}
          disabled={days === "" || parsed === 0 || note.trim() === ""}
        />
      }
    >
      <FormField
        id="adj-days"
        label="Days"
        hint="Negative to take days away. Half days are allowed where the type permits them."
      >
        <input
          id="adj-days"
          type="number"
          step="0.5"
          aria-describedby="adj-days-hint"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          required
          className={inputCls}
        />
      </FormField>

      {parsed !== 0 && (
        <Notice tone="info">
          {/* D5: adjustments add up — this one is added to those already made. */}
          Adds to {balance.adjustmentDays > 0 ? "+" : ""}
          {formatDays(balance.adjustmentDays)} already adjusted. {formatDays(balance.remainingDays)} left becomes{" "}
          <span className="font-semibold">{formatDays(balance.remainingDays + parsed)}</span>.
        </Notice>
      )}

      <FormField
        id="adj-note"
        label="Why"
        hint="Required. An unexplained adjustment is indistinguishable from a mistake a year later, and it is somebody's holiday."
      >
        <RichTextEditor id="adj-note" minHeight={102} describedBy="adj-note-hint" value={note} onChange={setNote} />
      </FormField>

      {error !== null && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
    </ModalFrame>
  );
}
