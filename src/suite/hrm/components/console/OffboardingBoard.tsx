"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  DoorOpen,
  Laptop,
  ShieldAlert,
} from "lucide-react";
import {
  EmptyState,
  Pill,
  ProgressBar,
  SectionCard,
} from "@/components/dashboard/ui";
import {
  ApiError,
  hrm,
  type Employee,
  type LeavingKind,
  type Offboarding,
  type OffboardingItem,
} from "@/lib/api/hrm-client";
import {
  Dialog,
  ErrorNote,
  Field,
  FormActions,
  HINT,
  INPUT,
  LABEL,
  useSubmit,
} from "./Dialog";
import { formatDate, nairaFromKobo } from "@/suite/hrm/lib/format";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { peopleOptions } from "./CaseWorkflow";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";

/**
 * Everybody on their way out.
 *
 * The board exists for one number, and it is in the header: **people who have
 * gone but are not cleared**. Each of them may still have a live login, a
 * building pass and an unreturned laptop, and nothing in the module surfaced
 * that before — `employees.ended_on` recorded that somebody left and said
 * nothing about what they took with them.
 */
export default function OffboardingBoard() {
  const [rows, setRows] = useState<Offboarding[] | null>(null);
  const [goneNotCleared, setGoneNotCleared] = useState(0);
  const [includeClosed, setIncludeClosed] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [announcing, setAnnouncing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hrm.offboardings
      .list(includeClosed)
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setGoneNotCleared(result.meta.goneButNotCleared);
        setError(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [includeClosed, reloadKey]);

  if (error !== null) {
    return (
      <SectionCard title="Leavers">
        <EmptyState icon={AlertTriangle} title="That did not load" hint={error} />
      </SectionCard>
    );
  }

  if (rows === null) {
    return (
      <div className="h-64 animate-pulse rounded-2xl border border-neutral-200 bg-neutral-50" />
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/*
        The access review, stated as a problem rather than a count. Somebody
        who has stopped coming in and still has a login is not a tidiness
        issue.
      */}
      {goneNotCleared > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-error-500/20 bg-error-500/5 p-4 sm:p-5">
          <ShieldAlert size={18} className="mt-0.5 shrink-0 text-error-700" />
          <div>
            <h2 className="text-sm font-semibold text-neutral-900">
              {goneNotCleared}{" "}
              {goneNotCleared === 1 ? "person has" : "people have"} gone without
              being cleared
            </h2>
            <p className="mt-1 text-sm text-neutral-700">
              They may still have a live login, a building pass and equipment
              that has not come back.
            </p>
          </div>
        </div>
      )}

      <SectionCard
        title="Leavers"
        subtitle="Announced, cleared item by item, then closed."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setIncludeClosed(!includeClosed)}
              className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              {includeClosed ? "Open only" : "Show closed"}
            </button>
            <button
              type="button"
              onClick={() => setAnnouncing(true)}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
            >
              Record a departure
            </button>
          </div>
        }
        bodyClassName={rows.length === 0 ? "p-5" : "p-0"}
      >
        {rows.length === 0 ? (
          <EmptyState
            icon={DoorOpen}
            title="Nobody is leaving"
            hint="Record a departure and its clearance list is raised for you."
            action={
              <button
                type="button"
                onClick={() => setAnnouncing(true)}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700"
              >
                Record a departure
              </button>
            }
          />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelected(selected === row.id ? null : row.id)}
                  className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-neutral-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {row.name ?? "Unnamed"}
                    </p>
                    <p className="truncate text-[11px] text-neutral-500">
                      {row.jobTitle ?? "-"} · leaves {formatDate(row.leavingOn)}
                    </p>
                  </div>

                  <Pill tone={row.isVoluntary ? "neutral" : "warning"}>
                    {row.kindLabel}
                  </Pill>

                  {/*
                    "Gone" is measured against the last working day, not the
                    leaving date: the question an access review asks is "are
                    they still coming in", not "is the contract technically
                    live".
                  */}
                  {row.hasGone && !row.isClearable && (
                    <Pill tone="error">Gone, not cleared</Pill>
                  )}

                  {/*
                    A closed departure says what it is rather than "Ready":
                    a cleared list with live-looking progress read as one
                    still waiting on somebody (H16).
                  */}
                  {row.status === "in_progress" ? (
                    <div className="w-28 shrink-0">
                      <ProgressBar value={row.progress} />
                      <p className="mt-1 text-right text-[11px] text-neutral-500">
                        {row.outstandingItems === 0
                          ? "Ready to clear"
                          : `${row.outstandingItems} left`}
                      </p>
                    </div>
                  ) : (
                    <StatusPill row={row} />
                  )}
                </button>

                {selected === row.id && (
                  <Detail
                    offboardingId={row.id}
                    onChanged={() => setReloadKey((k) => k + 1)}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {announcing && (
        <AnnounceDeparture
          onClose={() => setAnnouncing(false)}
          onStarted={() => {
            setAnnouncing(false);
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

const KINDS: { value: LeavingKind; label: string }[] = [
  { value: "resignation", label: "Resignation" },
  { value: "dismissal", label: "Dismissal" },
  { value: "redundancy", label: "Redundancy" },
  { value: "retirement", label: "Retirement" },
  { value: "end_of_contract", label: "End of contract" },
  { value: "death_in_service", label: "Death in service" },
];

/**
 * Announcing that somebody is leaving.
 *
 * The board could clear a departure and close it but never start one, so every
 * leaver had to be created by something else — which meant, in practice, that
 * nobody had a clearance list and the access review at the top of this screen
 * was permanently empty.
 *
 * Three decisions here are load-bearing.
 *
 * **Why they are leaving is asked first and is not free text.** Voluntary
 * versus involuntary is the distinction the whole of attrition analysis rests
 * on, and it cannot be recovered from a reason field afterwards.
 *
 * **The last working day is separate from the leaving date and may be left
 * blank.** Somebody on garden leave stops coming in weeks before the
 * employment ends, and "are they still coming in" is the question an access
 * review asks.
 *
 * **Rehireable has three states, not two.** A checkbox would record "no"
 * against every leaver nobody thought about — a quiet blacklist built out of
 * an unticked box.
 */
function AnnounceDeparture({
  onClose,
  onStarted,
}: {
  onClose: () => void;
  onStarted: () => void;
}) {
  const [people, setPeople] = useState<Employee[] | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [kind, setKind] = useState<LeavingKind>("resignation");
  const [leavingOn, setLeavingOn] = useState("");
  const [lastWorkingDay, setLastWorkingDay] = useState("");
  const [reason, setReason] = useState("");
  const [leavingFor, setLeavingFor] = useState("");
  const [rehireable, setRehireable] = useState<"" | "yes" | "no">("");
  // On by default (the owner's ruling on leavers): a leaver's login is the
  // access most often forgotten.
  const [disableSignIn, setDisableSignIn] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    hrm.employees
      .listAll()
      .then((all) => {
        if (!cancelled) setPeople(all);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);

    try {
      await hrm.offboardings.start(employeeId, {
        kind,
        leavingOn,
        /*
          Left off rather than sent equal to the leaving date. The service
          already defaults it, and sending a copy would record "they worked to
          the last day" when nobody actually said so.
        */
        lastWorkingDay: lastWorkingDay === "" ? null : lastWorkingDay,
        reason: reason === "" ? null : reason,
        leavingFor: leavingFor === "" ? null : leavingFor,
        isRehireable: rehireable === "" ? null : rehireable === "yes",
        disableSignIn,
      });
      onStarted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog title="Record a departure" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="leaver" className={LABEL}>
            Who is leaving
          </label>
          <SearchableSelect
            id="leaver"
            value={employeeId}
            onChange={setEmployeeId}
            required
            options={[
              { value: "", label: "Choose somebody" },
              ...peopleOptions(people ?? []),
            ]}
          />
        </div>

        <div>
          <label htmlFor="leaving-kind" className={LABEL}>
            Why
          </label>
          <SearchableSelect
            id="leaving-kind"
            aria-describedby="leaving-kind-hint"
            value={kind}
            onChange={(v) => setKind(v as LeavingKind)}
            options={KINDS.map((option) => ({ value: option.value, label: option.label }))}
          />
          <p id="leaving-kind-hint" className={HINT}>
            This decides the clearance list, whether an exit interview is
            offered, and which side of the turnover figure they fall on.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="leaving-on" className={LABEL}>
              Employment ends
            </label>
            <input
              id="leaving-on"
              type="date"
              value={leavingOn}
              onChange={(e) => setLeavingOn(e.target.value)}
              required
              className={INPUT}
            />
          </div>

          <div>
            <label htmlFor="last-working-day" className={LABEL}>
              Last working day
            </label>
            <input
              id="last-working-day"
              type="date"
              aria-describedby="last-working-day-hint"
              value={lastWorkingDay}
              onChange={(e) => setLastWorkingDay(e.target.value)}
              className={INPUT}
            />
            <p id="last-working-day-hint" className={HINT}>
              Only if it differs {"-"} garden leave, or notice served at home.
            </p>
          </div>
        </div>

        <div>
          <label htmlFor="leaving-reason" className={LABEL}>
            Reason
          </label>
          <RichTextEditor id="leaving-reason" minHeight={102} value={reason} onChange={setReason} />
        </div>

        {/*
          Only worth asking when they chose to go. Asking where a dismissed
          employee is going is neither answerable nor decent.
        */}
        {(kind === "resignation" || kind === "retirement") && (
          <div>
            <label htmlFor="leaving-for" className={LABEL}>
              Leaving for
            </label>
            <input
              id="leaving-for"
              aria-describedby="leaving-for-hint"
              value={leavingFor}
              onChange={(e) => setLeavingFor(e.target.value)}
              maxLength={255}
              className={INPUT}
            />
            <p id="leaving-for-hint" className={HINT}>
              Where they are going, if they said. It is the only way to see
              that four people left for the same employer.
            </p>
          </div>
        )}

        <div>
          <label htmlFor="rehireable" className={LABEL}>
            Would we have them back
          </label>
          <SearchableSelect
            id="rehireable"
            aria-describedby="rehireable-hint"
            value={rehireable}
            onChange={(v) => setRehireable(v as "" | "yes" | "no")}
            options={[
              { value: "", label: "Not recorded" },
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
          <p id="rehireable-hint" className={HINT}>
            Leave it unrecorded unless somebody has actually decided. A stray
            {" "}
            {"“"}no{"”"} follows a person into every future application.
          </p>
        </div>

        <SignInToggle id="announce-sign-in" checked={disableSignIn} onChange={setDisableSignIn} />

        {error !== null && <p className="text-sm text-error-700">{error}</p>}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || employeeId === "" || leavingOn === ""}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            Record it
          </button>
        </div>
      </form>
    </Dialog>
  );
}

/**
 * One departure, opened in place.
 *
 * Loaded on expand rather than with the list: a clearance list is a dozen rows
 * per person and fetching them all up front would make a page of forty leavers
 * carry five hundred items nobody asked to see.
 */
function Detail({
  offboardingId,
  onChanged,
}: {
  offboardingId: string;
  onChanged: () => void;
}) {
  const [record, setRecord] = useState<Offboarding | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [interviewing, setInterviewing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [settling, setSettling] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = () => {
    setReloadKey((k) => k + 1);
    onChanged();
  };

  useEffect(() => {
    let cancelled = false;

    hrm.offboardings
      .get(offboardingId)
      .then((result) => {
        if (!cancelled) setRecord(result);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [offboardingId, reloadKey]);

  const act = async (key: string, action: () => Promise<Offboarding>) => {
    setBusy(key);
    setError(null);

    try {
      setRecord(await action());
      onChanged();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(null);
    }
  };

  if (record === null) {
    return <div className="h-32 animate-pulse bg-neutral-50" />;
  }

  const items = record.items ?? [];
  // Cleared or called off: the record reads as history, with nothing left to press.
  const open = record.status === "in_progress";

  return (
    <div className="space-y-4 border-t border-neutral-100 bg-neutral-50/60 px-5 py-4">
      {error !== null && (
        <p className="rounded-lg bg-error-500/10 px-3 py-2 text-sm text-error-700">
          {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Fact label="Notice given" value={formatDate(record.noticeGivenOn)} />
        <Fact label="Last working day" value={formatDate(record.lastWorkingDay)} />
        <Fact label="Leaves" value={formatDate(record.leavingOn)} />
        <Fact
          label="Notice"
          value={record.noticeDays === null ? "-" : `${record.noticeDays} days`}
        />
      </div>

      {/* ------------------------- the checklist -------------------- */}

      <ul className="space-y-1.5">
        {items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            locked={!open}
            costLocked={record.status === "cancelled" || record.finalPay?.status === "paid"}
            onCost={(kobo) =>
              void act(item.id, () => hrm.offboardings.updateItemCost(item.id, kobo))
            }
            busy={busy === item.id}
            onComplete={() =>
              void act(item.id, () => hrm.offboardings.completeItem(item.id))
            }
            onWaive={(reason) =>
              void act(item.id, () => hrm.offboardings.waiveItem(item.id, reason))
            }
          />
        ))}
      </ul>

      {/* ---------------------- what they kept ---------------------- */}

      {(record.unreturnedCostKobo ?? 0) > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-warning-50 px-3 py-2 text-[11px] text-warning-800">
          <Laptop size={13} className="shrink-0" />
          {nairaFromKobo(record.unreturnedCostKobo ?? 0)} of equipment has not
          come back. It comes off the final settlement; change an item&apos;s value
          to change the deduction.
        </p>
      )}

      {record.outstandingLeaveDays !== null
        && record.outstandingLeaveDays !== undefined && (
        <p className="text-[11px] text-neutral-600">
          {record.outstandingLeaveDays} days of leave outstanding, frozen at
          settlement.
        </p>
      )}

      <SettlementSummary record={record} />

      {!open && <ClosedNotice record={record} />}

      {open && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
          >
            Add an item
          </button>

          {/*
            Offered only where it is appropriate. Asking somebody who has just
            been dismissed to rate their experience is worse than not asking, and
            `warrantsExitInterview` on the leaving kind is what decides it.
          */}
          {record.isVoluntary && (
            <button
              type="button"
              onClick={() => setInterviewing(true)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Exit interview
            </button>
          )}

          {/*
            Opens a dialog for the figure (H15): it goes to their next payroll
            run. Offered again to correct it until that run is approved.
          */}
          {record.finalPay?.status !== "paid" && (
            <button
              type="button"
              onClick={() => setSettling(true)}
              className="rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              {record.settledAt === null ? "Work out what they are owed" : "Change the settlement"}
            </button>
          )}

          {/*
            The only action that ends the employment. Disabled rather than hidden
            when items are outstanding, so it is obvious that clearing is the
            next step and what is holding it up.
          */}
          <button
            type="button"
            disabled={!record.isClearable || busy === "clear"}
            title={
              record.isClearable
                ? undefined
                : "Complete or waive every required item first."
            }
            onClick={() => setClearing(true)}
            className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            Clear and end employment
          </button>

          {/*
            Last, and quiet. A departure that is called off is a real and happy
            thing — somebody withdrew a resignation — but it is rare, and putting
            it beside "clear and end employment" would make an irreversible
            action easy to hit by mistake.
          */}
          <button
            type="button"
            onClick={() => setCancelling(true)}
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-500 transition-colors hover:bg-white hover:text-neutral-700"
          >
            They are staying
          </button>
        </div>
      )}

      {settling && (
        <SettleDialog
          record={record}
          onClose={() => setSettling(false)}
          onSettled={(settled) => {
            setSettling(false);
            setRecord(settled);
            onChanged();
          }}
        />
      )}

      {clearing && (
        <ClearDialog
          record={record}
          onClose={() => setClearing(false)}
          onCleared={(cleared) => {
            setClearing(false);
            setRecord(cleared);
            onChanged();
          }}
        />
      )}

      {adding && (
        <AddItemDialog
          offboardingId={record.id}
          onClose={() => setAdding(false)}
          onAdded={() => {
            setAdding(false);
            reload();
          }}
        />
      )}

      {interviewing && (
        <ExitInterviewDialog
          record={record}
          onClose={() => setInterviewing(false)}
          onSaved={() => {
            setInterviewing(false);
            reload();
          }}
        />
      )}

      {cancelling && (
        <CancelDepartureDialog
          record={record}
          onClose={() => setCancelling(false)}
          onCancelled={() => {
            setCancelling(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

/**
 * The final settlement and where it stands with payroll (H15).
 *
 * The figure used to stop on this record and payroll never heard of it. It is
 * now a "Final settlement" line on the leaver's next payroll run, and this says
 * which: still waiting, or paid on a named run.
 */
function SettlementSummary({ record }: { record: Offboarding }) {
  if (record.settledAt === null || record.settledAt === undefined) return null;

  const pay = record.finalPay ?? null;

  return (
    <div className="rounded-xl border border-neutral-200 bg-white px-3.5 py-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-neutral-800">
          Final settlement:{" "}
          <span className="tabular-nums">
            {record.finalSettlementKobo === null || record.finalSettlementKobo === undefined
              ? "no figure"
              : nairaFromKobo(record.finalSettlementKobo)}
          </span>
        </p>
        {pay !== null && (
          <Pill tone={pay.status === "paid" ? "success" : "info"}>
            {pay.status === "paid" ? `Paid on ${pay.runReference ?? "a payroll run"}` : "Waiting for the next payroll run"}
          </Pill>
        )}
      </div>
      {(record.unreturnedCostKobo ?? 0) > 0 && record.finalSettlementKobo != null && (
        <p className="mt-1.5 tabular-nums text-neutral-600">
          Less {nairaFromKobo(record.unreturnedCostKobo ?? 0)} for equipment not returned:{" "}
          <span className="font-semibold text-neutral-800">
            {nairaFromKobo(record.netSettlementKobo ?? 0)} to payroll
          </span>
        </p>
      )}
      {record.finalSettlementNote && (
        <p className="mt-1.5 text-neutral-600">{record.finalSettlementNote}</p>
      )}
      {pay === null && (
        <p className="mt-1.5 text-neutral-500">Nothing goes to payroll until a figure above zero is entered.</p>
      )}
    </div>
  );
}

/**
 * What the leaver is owed, sent to payroll (H15).
 *
 * Working it out still freezes their leave balance as before. The figure, if
 * any, becomes a "Final settlement" earning on the next payroll run that pays
 * them — a settlement-only payslip if they have already left — and the note is
 * printed beside it so the payslip explains itself.
 */
function SettleDialog({
  record,
  onClose,
  onSettled,
}: {
  record: Offboarding;
  onClose: () => void;
  onSettled: (settled: Offboarding) => void;
}) {
  const [amount, setAmount] = useState(
    record.finalSettlementKobo === null || record.finalSettlementKobo === undefined
      ? ""
      : String(record.finalSettlementKobo / 100),
  );
  const [note, setNote] = useState(record.finalSettlementNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kobo = amount.trim() === "" ? null : Math.round(Number(amount) * 100);
  const invalid = kobo !== null && (!Number.isFinite(kobo) || kobo < 0);
  // Equipment not returned comes off what is owed; the checklist holds the values.
  const unreturned = (record.items ?? []).filter(
    (i) => i.isAsset && !i.wasReturned && (i.replacementCostKobo ?? 0) > 0,
  );
  const deductions = unreturned.reduce((sum, i) => sum + (i.replacementCostKobo ?? 0), 0);
  const net = (kobo ?? 0) - deductions;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      onSettled(await hrm.offboardings.settle(record.id, kobo, note.trim() === "" ? null : note.trim()));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not save.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      title="Final settlement"
      subtitle={`${record.name ?? "This person"} · leaves ${formatDate(record.leavingOn)}`}
      onClose={onClose}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-3">
        <Field
          id="st-amount"
          label="Amount owed before deductions (₦)"
          hint="Untaken leave, notice pay and anything else owed. Equipment not returned is taken off below. Leave empty to record the leave balance only."
        >
          <input
            id="st-amount"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            aria-describedby="st-amount-hint"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT}
          />
        </Field>

        <Field id="st-note" label="How it was worked out" hint="Printed on their payslip beside the amount.">
          {/* Plain text on purpose: it is printed on a payslip line, which holds plain words only. */}
          <textarea
            id="st-note"
            aria-describedby="st-note-hint"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className={INPUT}
          />
        </Field>

        {kobo !== null && kobo > 0 && deductions > 0 && (
          <div className="rounded-lg border border-neutral-200 px-3 py-2 text-[11px] text-neutral-700">
            <p className="font-medium text-neutral-800">Deducted for equipment not returned</p>
            <ul className="mt-1 space-y-0.5">
              {unreturned.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 tabular-nums">
                  <span className="min-w-0 truncate">
                    {i.title}
                    {i.source === "operations" ? " · from the exit clearance" : ""}
                  </span>
                  <span>−{nairaFromKobo(i.replacementCostKobo ?? 0)}</span>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-neutral-500">Change a value on the checklist to change what is deducted.</p>
          </div>
        )}

        {kobo !== null && kobo > 0 && (
          <p className="rounded-lg bg-primary-50 px-3 py-2 text-[11px] text-primary-800">
            {net > 0 ? (
              <>
                {nairaFromKobo(net)} goes on their next payroll run as a taxable &quot;Final
                settlement&quot; line. If they have already left, that run gives them a
                payslip for the settlement alone.
              </>
            ) : (
              <>
                The deductions are more than what is owed, so nothing goes to payroll. They
                owe {nairaFromKobo(-net)}.
              </>
            )}
          </p>
        )}

        <ErrorNote error={error ?? (invalid ? "Enter an amount of zero or more." : null)} />
        <FormActions
          onCancel={onClose}
          submitLabel={record.settledAt ? "Save settlement" : "Settle"}
          saving={saving}
          disabled={invalid}
        />
      </form>
    </Dialog>
  );
}

/**
 * A clearance item the standard list does not cover.
 *
 * The raised checklist is the same for everybody leaving for a given reason,
 * which is right for a default and wrong for the ward sister who also holds a
 * controlled-drugs key. Without this, those get written on a sticky note.
 */
function AddItemDialog({
  offboardingId,
  onClose,
  onAdded,
}: {
  offboardingId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"task" | "asset">("task");
  const [ownerRole, setOwnerRole] = useState("hr");
  const [assetTag, setAssetTag] = useState("");
  const [cost, setCost] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const { submit, saving, error } = useSubmit(onAdded);

  return (
    <Dialog
      title="Add a clearance item"
      subtitle="Something this person has to return or do that the standard list does not cover."
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.offboardings.addItem(offboardingId, {
              title,
              kind,
              ownerRole,
              assetTag: assetTag === "" ? null : assetTag,
              /*
                Kobo, like every other money column in the module. A naira
                figure typed here becomes the deduction on somebody's final
                pay, so the conversion happens once, here, rather than being
                assumed at either end.
              */
              replacementCostKobo:
                cost === "" ? null : Math.round(Number(cost) * 100),
              isRequired,
            }),
          )
        }
        className="space-y-3"
      >
        <Field id="oi-title" label="What">
          <input
            id="oi-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={255}
            required
            className={INPUT}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="oi-kind"
            label="Kind"
            hint="An asset is something physical that can fail to come back."
          >
            <SearchableSelect
              id="oi-kind"
              aria-describedby="oi-kind-hint"
              value={kind}
              onChange={(v) => setKind(v as "task" | "asset")}
              options={[
                { value: "task", label: "A task" },
                { value: "asset", label: "Something to return" },
              ]}
            />
          </Field>

          <Field id="oi-owner" label="Whose job">
            <SearchableSelect
              id="oi-owner"
              value={ownerRole}
              onChange={setOwnerRole}
              options={[
                { value: "hr", label: "HR" },
                { value: "it", label: "IT" },
                { value: "finance", label: "Finance" },
                { value: "manager", label: "Their manager" },
                { value: "employee", label: "Them" },
              ]}
            />
          </Field>
        </div>

        {kind === "asset" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="oi-tag" label="Asset tag">
              <input
                id="oi-tag"
                value={assetTag}
                onChange={(e) => setAssetTag(e.target.value)}
                maxLength={64}
                className={INPUT}
              />
            </Field>

            <Field
              id="oi-cost"
              label="Replacement cost"
              hint="In naira. Deducted from the final settlement if it is waived unreturned."
            >
              <input
                id="oi-cost"
                type="number"
                min={0}
                step="0.01"
                aria-describedby="oi-cost-hint"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className={INPUT}
              />
            </Field>
          </div>
        )}

        {/*
          Required is the default and the one that matters: only required items
          hold up clearing, and an optional item is a reminder rather than a
          gate.
        */}
        <div className="flex items-start gap-2 rounded-xl border border-neutral-200 px-3 py-2.5">
          <input
            id="oi-required"
            type="checkbox"
            aria-describedby="oi-required-hint"
            checked={isRequired}
            onChange={(e) => setIsRequired(e.target.checked)}
            className="mt-0.5"
          />
          <div>
            <label htmlFor="oi-required" className="text-xs text-neutral-700">
              This has to be done before they can be cleared
            </label>
            <p id="oi-required-hint" className="mt-0.5 text-[11px] text-neutral-500">
              Untick for a reminder that should not hold up ending the
              employment.
            </p>
          </div>
        </div>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Add"
          saving={saving}
          disabled={title.trim() === ""}
        />
      </form>
    </Dialog>
  );
}

/**
 * What they said on the way out.
 *
 * The only moment an institution reliably hears the truth about itself, and it
 * had nowhere to go. `leavingFor` and `isRehireable` are here as well as on
 * the departure form on purpose: the honest answers to both usually arrive at
 * the interview rather than on the day notice was handed in.
 */
function ExitInterviewDialog({
  record,
  onClose,
  onSaved,
}: {
  record: Offboarding;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState("");
  const [leavingFor, setLeavingFor] = useState(record.leavingFor ?? "");
  const [rehireable, setRehireable] = useState<"" | "yes" | "no">(
    record.isRehireable == null ? "" : record.isRehireable ? "yes" : "no",
  );
  const { submit, saving, error } = useSubmit(onSaved);

  return (
    <Dialog
      title="Exit interview"
      subtitle={`${record.name ?? "Unnamed"} · ${record.kindLabel}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () =>
            hrm.offboardings.recordExitInterview(record.id, {
              notes: notes === "" ? null : notes,
              rating: rating === "" ? null : Number(rating),
              leavingFor: leavingFor === "" ? null : leavingFor,
              isRehireable: rehireable === "" ? null : rehireable === "yes",
            }),
          )
        }
        className="space-y-3"
      >
        <Field
          id="ei-notes"
          label="What they said"
          hint="In their words where you can. A summary written to be comfortable is worth nothing six months later."
        >
          <RichTextEditor id="ei-notes" variant="full" describedBy="ei-notes-hint" value={notes} onChange={setNotes} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            id="ei-rating"
            label="How they rated working here"
            hint="Out of five. Leave blank if they would rather not say."
          >
            <SearchableSelect
              id="ei-rating"
              aria-describedby="ei-rating-hint"
              value={rating}
              onChange={setRating}
              options={[
                { value: "", label: "Not given" },
                { value: "1", label: "1 (poor)" },
                { value: "2", label: "2" },
                { value: "3", label: "3" },
                { value: "4", label: "4" },
                { value: "5", label: "5 (very good)" },
              ]}
            />
          </Field>

          <Field
            id="ei-leaving-for"
            label="Leaving for"
            hint="The only way to see that four people left for the same employer."
          >
            <input
              id="ei-leaving-for"
              aria-describedby="ei-leaving-for-hint"
              value={leavingFor}
              onChange={(e) => setLeavingFor(e.target.value)}
              maxLength={255}
              className={INPUT}
            />
          </Field>
        </div>

        {/*
          Three states here too. An interview is often where this is actually
          decided, and a default of "no" would put a quiet block on somebody
          who left on perfectly good terms.
        */}
        <Field
          id="ei-rehireable"
          label="Would we have them back"
          hint="Leave unrecorded unless somebody has actually decided. It follows a person into every future application."
        >
          <SearchableSelect
            id="ei-rehireable"
            aria-describedby="ei-rehireable-hint"
            value={rehireable}
            onChange={(v) => setRehireable(v as "" | "yes" | "no")}
            options={[
              { value: "", label: "Not recorded" },
              { value: "yes", label: "Yes" },
              { value: "no", label: "No" },
            ]}
          />
        </Field>

        <ErrorNote error={error} />
        <FormActions onCancel={onClose} submitLabel="Record" saving={saving} />
      </form>
    </Dialog>
  );
}

/**
 * Calling a departure off.
 *
 * A withdrawn resignation is a good day, and without this the only way to
 * record one was to let the offboarding run to completion and end somebody's
 * employment anyway.
 */
function CancelDepartureDialog({
  record,
  onClose,
  onCancelled,
}: {
  record: Offboarding;
  onClose: () => void;
  onCancelled: () => void;
}) {
  const [reason, setReason] = useState("");
  const { submit, saving, error } = useSubmit(onCancelled);

  return (
    <Dialog
      title="They are staying"
      subtitle={`${record.name ?? "Unnamed"} · leaving date ${formatDate(record.leavingOn)}`}
      onClose={onClose}
    >
      <form
        onSubmit={(e) =>
          submit(e, () => hrm.offboardings.cancel(record.id, reason))
        }
        className="space-y-3"
      >
        <Field
          id="cd-reason"
          label="What changed"
          hint="The clearance list closes with it. Their employment record is untouched: they never left."
        >
          <RichTextEditor id="cd-reason" minHeight={128} describedBy="cd-reason-hint" value={reason} onChange={setReason} />
        </Field>

        <ErrorNote error={error} />
        <FormActions
          onCancel={onClose}
          submitLabel="Call it off"
          saving={saving}
          disabled={reason.trim() === ""}
        />
      </form>
    </Dialog>
  );
}

/**
 * One item, with the two ways of closing it.
 *
 * Waiving asks for a reason inline rather than in a dialog, because the reason
 * is short and the alternative is a modal for one sentence. It is required for
 * the same argument as a declined leave request: a deduction on somebody's
 * final pay has to be explainable a year later.
 */
function ItemRow({
  item,
  locked = false,
  costLocked = false,
  busy,
  onComplete,
  onWaive,
  onCost,
}: {
  item: OffboardingItem;
  /** The departure is closed: show the row, offer nothing. */
  locked?: boolean;
  /** The final pay has gone out (or the departure was cancelled): the deduction is fixed. */
  costLocked?: boolean;
  busy: boolean;
  onComplete: () => void;
  onWaive: (reason: string) => void;
  onCost?: (kobo: number | null) => void;
}) {
  const [waiving, setWaiving] = useState(false);
  const [reason, setReason] = useState("");
  const [editingCost, setEditingCost] = useState(false);
  const [cost, setCost] = useState(
    item.replacementCostKobo === null ? "" : String(item.replacementCostKobo / 100),
  );
  const costKobo = cost.trim() === "" ? null : Math.round(Number(cost) * 100);
  const costInvalid = costKobo !== null && (!Number.isFinite(costKobo) || costKobo < 0);

  return (
    <li className="rounded-lg border border-neutral-200 bg-white px-3 py-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-sm text-neutral-800">
          {item.title}
          {!item.isRequired && (
            <span className="ml-2 text-[11px] text-neutral-500">optional</span>
          )}
        </span>

        {item.isAsset && <Pill tone="neutral">Asset</Pill>}
        {item.source === "operations" && <Pill tone="info">From the exit clearance</Pill>}

        {item.isClosed ? (
          <span
            className={`inline-flex items-center gap-1 text-[11px] ${
              item.wasReturned || item.completedAt !== null
                ? "text-success-700"
                : "text-warning-700"
            }`}
          >
            <Check size={13} />
            {item.completedAt !== null ? "Done" : "Waived"}
          </span>
        ) : locked ? (
          <span className="text-[11px] text-neutral-500">Not done</span>
        ) : (
          <div className="flex gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={onComplete}
              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-60"
            >
              Done
            </button>
            <button
              type="button"
              onClick={() => setWaiving(!waiving)}
              className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Waive
            </button>
          </div>
        )}
      </div>

      {item.waivedReason !== null && (
        <p className="mt-1 text-[11px] text-warning-700">{item.waivedReason}</p>
      )}

      {item.isAsset && !item.wasReturned && !editingCost && (
        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-neutral-600">
          <span className="tabular-nums">
            {item.replacementCostKobo === null || item.replacementCostKobo === 0
              ? "Nothing deducted"
              : `${item.isClosed ? "Deducted" : "Deducted if not returned"}: ${nairaFromKobo(item.replacementCostKobo)}`}
            {item.costEditedAt ? " · set by HR" : ""}
          </span>
          {!costLocked && onCost && (
            <button
              type="button"
              onClick={() => setEditingCost(true)}
              className="rounded border border-neutral-200 px-2 py-0.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-50"
            >
              Change
            </button>
          )}
        </div>
      )}

      {editingCost && (
        <form
          className="mt-2 flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (costInvalid || !onCost) return;
            onCost(costKobo);
            setEditingCost(false);
          }}
        >
          <label htmlFor={`cost-${item.id}`} className="text-[11px] text-neutral-600">
            Deduct (₦)
          </label>
          <input
            id={`cost-${item.id}`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            className="w-36 rounded border border-neutral-200 px-2 py-1 text-xs tabular-nums outline-none focus:border-primary-500"
          />
          <button
            type="submit"
            disabled={costInvalid || busy}
            className="rounded bg-primary-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditingCost(false)}
            className="rounded border border-neutral-200 px-2 py-0.5 text-[11px] font-medium text-neutral-700 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <span className="w-full text-[11px] text-neutral-500">Zero means nothing is deducted. The final settlement follows.</span>
        </form>
      )}

      {waiving && !item.isClosed && (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why will this never be done?"
            className="min-w-0 flex-1 rounded border border-neutral-200 px-2 py-1 text-xs outline-none focus:border-primary-500"
          />
          <button
            type="button"
            disabled={reason.trim() === "" || busy}
            onClick={() => {
              onWaive(reason);
              setWaiving(false);
              setReason("");
            }}
            className="rounded bg-warning-600 px-2.5 py-1 text-[11px] font-medium text-white transition-colors hover:bg-warning-700 disabled:opacity-40"
          >
            Waive it
          </button>
        </div>
      )}
    </li>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-neutral-500">{label}</p>
      <p className="truncate text-sm font-medium text-neutral-900">{value}</p>
    </div>
  );
}

/** "Cleared · leaves 31 Oct", "Cleared · left", or "Called off", in place of progress. */
function StatusPill({ row }: { row: Offboarding }) {
  if (row.status === "cancelled") return <Pill tone="neutral">Called off</Pill>;

  if (row.awaitsLeavingDate === true) {
    return <Pill tone="info">Cleared · leaves {formatDate(row.leavingOn)}</Pill>;
  }

  return (
    <Pill tone="success" dot>
      Cleared · left
    </Pill>
  );
}

/** What a closed departure means now, instead of buttons that no longer apply. */
function ClosedNotice({ record }: { record: Offboarding }) {
  if (record.status === "cancelled") {
    return (
      <p className="rounded-lg bg-neutral-100 px-3 py-2 text-[11px] text-neutral-700">
        This departure was called off. They are still employed; the list is kept as a record.
      </p>
    );
  }

  const signIn = record.disableSignIn === false ? "" : ", and their sign-in is switched off";
  const clearedOn = record.clearedAt ? ` on ${formatDate(record.clearedAt)}` : "";

  let text = `Cleared. Their employment ended on ${formatDate(record.leavingOn)}.`;

  if (record.awaitsLeavingDate === true) {
    text = `Cleared${clearedOn}. Their employment ends on ${formatDate(record.leavingOn)}: that morning their HR, project and learning roles are removed and they come off every project team${signIn}.`;
  } else if (record.accessRevokedAt) {
    text = `Cleared. Their employment ended on ${formatDate(record.leavingOn)} and their access was removed on ${formatDate(record.accessRevokedAt)}.`;
  }

  return (
    <p className="flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-700">
      <Check size={13} className="mt-px shrink-0" />
      {text}
    </p>
  );
}

/**
 * The "Disable sign-in" tick-box (the owner's ruling on leavers, 2 Oct 2026).
 * On by default. Acted on on the leaving date, never before: somebody serving
 * notice still signs in to work. Organisation admins keep their sign-in.
 */
export function SignInToggle({
  id,
  checked,
  onChange,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-neutral-200 bg-white px-3 py-2.5">
      <input
        id={id}
        type="checkbox"
        aria-describedby={`${id}-hint`}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-primary-600"
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-neutral-800">
          Disable sign-in on their leaving date
        </label>
        <p id={`${id}-hint`} className={HINT}>
          Their HR, project and learning roles and their project places go on that date either way.
          Untick to let them keep signing in, for example to finish a course. An organisation admin
          always keeps their sign-in.
        </p>
      </div>
    </div>
  );
}

/**
 * Clearing, confirmed. Says plainly when the employment ends: on the leaving
 * date, not today, unless that date has come (D15).
 */
function ClearDialog({
  record,
  onClose,
  onCleared,
}: {
  record: Offboarding;
  onClose: () => void;
  onCleared: (cleared: Offboarding) => void;
}) {
  const [disableSignIn, setDisableSignIn] = useState(record.disableSignIn !== false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [future] = useState(
    () => new Date(`${record.leavingOn}T00:00:00`).getTime() > Date.now(),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);

    try {
      onCleared(await hrm.offboardings.clear(record.id, { disableSignIn }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
      setSaving(false);
    }
  };

  return (
    <Dialog
      title={`Clear ${record.name ?? "this departure"}`}
      subtitle={
        future
          ? `Everything is back and done. Their employment ends on ${formatDate(record.leavingOn)}, not today: they stay on the rota and the payroll until then.`
          : "Everything is back and done. Their employment ends now, on the leaving date recorded."
      }
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4">
        <SignInToggle id="clear-sign-in" checked={disableSignIn} onChange={setDisableSignIn} />
        <ErrorNote error={error} />
        <FormActions onCancel={onClose} submitLabel="Clear and end employment" saving={saving} />
      </form>
    </Dialog>
  );
}
