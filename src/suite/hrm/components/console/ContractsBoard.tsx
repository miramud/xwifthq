"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, FilePlus2, FileSignature, RefreshCw, Timer } from "lucide-react";
import {
  Button,
  Chip,
  Empty,
  PageHeader,
  StatCard,
  StatGrid,
  buttonClass,
} from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { JobTitlePicker } from "@/components/workspace/JobTitlePicker";
import { hueFor } from "@/components/workspace/modules";
import {
  ApiError,
  hrm,
  type EmploymentContract,
} from "@/lib/api/hrm-client";
import {
  IssueContractDialog,
  TerminateContractDialog,
} from "./ContractActions";
import {
  contractTone,
  countdownTone,
  formatCountdown,
  formatDate,
  salary,
} from "@/suite/hrm/lib/format";
import { IconTile, PersonCell, ToneChip } from "../ui/recordKit";
import { Notice } from "@/suite/hrm/components/ui2/kit";

/**
 * Agreements that need doing something about.
 *
 * Two lists, never merged. An agreement still in force past its end date means
 * somebody is working with nothing covering them, that is not "expiring soon"
 * at a higher urgency, it is a different problem, and sorting both by date
 * would file it among things that are merely scheduled.
 *
 * Renewing is the only action offered here. It writes a new agreement and
 * closes the old one, because the terms somebody worked under last year are
 * what anybody comes looking for.
 */
export default function ContractsBoard() {
  const [expiring, setExpiring] = useState<EmploymentContract[] | null>(null);
  const [overrunning, setOverrunning] = useState<EmploymentContract[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [renewing, setRenewing] = useState<EmploymentContract | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [terminating, setTerminating] = useState<EmploymentContract | null>(
    null,
  );

  const load = useCallback(
    () =>
      hrm.contracts
        .watchlist(90)
        .then((res) => {
          setExpiring(res.data.expiring);
          setOverrunning(res.data.overrunning);
          setError(null);
        })
        .catch((e: Error) => setError(e.message)),
    [],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const within30 = (expiring ?? []).filter((c) => c.daysRemaining !== null && c.daysRemaining <= 30).length;

  return (
    <div>
      <PageHeader
        title="Contracts"
        subtitle="Agreements past their end date, and agreements ending in the next 90 days."
        actions={
          /*
            The board was a watchlist, so the only agreement that could exist in
            the product was one renewed from an agreement something else created.
            A first contract could not be issued at all.
          */
          <Button variant="primary" icon={FilePlus2} onClick={() => setIssuing(true)}>
            Issue an agreement
          </Button>
        }
      />

      {error !== null && (
        <Notice tone="error" role="alert" className="mb-4">
          {error}
        </Notice>
      )}

      {expiring === null ? (
        <div className="ws-card h-64 animate-pulse bg-neutral-50" aria-busy="true" aria-label="Loading" />
      ) : (
        <div className="space-y-6">
          <StatGrid cols={3}>
            <StatCard
              icon={AlertTriangle}
              hue={overrunning.length > 0 ? "coral" : "mint"}
              label="Working without an agreement"
              value={overrunning.length}
              hint="Past the end date and still in force"
            />
            <StatCard icon={CalendarClock} hue="sun" label="Ending within 30 days" value={within30} hint="Renew or end these first" />
            <StatCard icon={Timer} hue="sky" label="Ending in 90 days" value={expiring.length} hint="Everything with a date to watch" />
          </StatGrid>

          {overrunning.length > 0 && (
            <section aria-labelledby="contracts-overrun">
              <div className="mb-3 flex items-center gap-3">
                <IconTile icon={AlertTriangle} hue="coral" size={36} />
                <div>
                  <h2 id="contracts-overrun" className="text-lg font-bold tracking-tight text-neutral-900">
                    Working without an agreement
                  </h2>
                  <p className="text-sm text-neutral-500">
                    {`${overrunning.length} agreement${overrunning.length === 1 ? "" : "s"} past the end date and still in force`}
                  </p>
                </div>
              </div>
              <ContractList
                rows={overrunning}
                storageKey="hrm.contracts.overrun"
                onRenew={setRenewing}
                onTerminate={setTerminating}
              />
            </section>
          )}

          <section aria-labelledby="contracts-ending">
            <div className="mb-3 flex items-center gap-3">
              <IconTile icon={CalendarClock} hue="sky" size={36} />
              <div>
                <h2 id="contracts-ending" className="text-lg font-bold tracking-tight text-neutral-900">
                  Ending soon
                </h2>
                <p className="text-sm text-neutral-500">Next 90 days</p>
              </div>
            </div>
            <ContractList
              rows={expiring}
              storageKey="hrm.contracts.ending"
              onRenew={setRenewing}
              onTerminate={setTerminating}
              empty={
                <Empty
                  icon={FileSignature}
                  hue="mint"
                  title="Nothing ending in the next 90 days"
                  hint={
                    overrunning.length > 0
                      ? "Anything already overrun is listed above."
                      : "Open-ended agreements never appear here, as there is no date to watch."
                  }
                />
              }
            />
          </section>
        </div>
      )}

      {issuing && (
        <IssueContractDialog
          onClose={() => setIssuing(false)}
          onIssued={() => {
            setIssuing(false);
            void load();
          }}
        />
      )}

      {terminating !== null && (
        <TerminateContractDialog
          contract={terminating}
          onClose={() => setTerminating(null)}
          onTerminated={() => {
            setTerminating(null);
            void load();
          }}
        />
      )}

      {renewing !== null && (
        <RenewDialog
          contract={renewing}
          onClose={() => setRenewing(null)}
          onRenewed={() => {
            setRenewing(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ContractList({
  rows,
  storageKey,
  onRenew,
  onTerminate,
  empty,
}: {
  rows: EmploymentContract[];
  storageKey: string;
  onRenew: (contract: EmploymentContract) => void;
  onTerminate: (contract: EmploymentContract) => void;
  empty?: React.ReactNode;
}) {
  const name = (c: EmploymentContract) => c.employee?.name ?? "Unnamed";
  const href = (c: EmploymentContract) => (c.employee ? `/suite/hrm/people/${c.employee.id}` : undefined);

  const actions = (contract: EmploymentContract) => (
    <div className="flex shrink-0 items-center gap-1.5">
      <Button variant="primary" size="sm" icon={RefreshCw} onClick={() => onRenew(contract)}>
        Renew
      </Button>
      {/*
        The other half of a countdown. A term running out because somebody is
        leaving needs ending, not renewing, and without this the only way to
        record that was to let the agreement lapse and hope.
      */}
      <button
        type="button"
        onClick={() => onTerminate(contract)}
        aria-label={`End ${contract.employee?.name ?? "this agreement"}`}
        className={buttonClass("secondary", "sm")}
      >
        End it
      </button>
    </div>
  );

  const chips = (c: EmploymentContract) => (
    <>
      <ToneChip tone={contractTone(c.status)}>{c.statusLabel}</ToneChip>
      <ToneChip tone={countdownTone(c.daysRemaining)} dot={false} icon={Timer}>
        {formatCountdown(c.daysRemaining)}
      </ToneChip>
    </>
  );

  const columns: Column<EmploymentContract>[] = [
    {
      key: "name",
      header: "Person",
      primary: true,
      sortable: true,
      value: (c) => name(c),
      render: (c) => (
        <PersonCell
          name={name(c)}
          sub={`${c.jobTitle}${c.department ? ` · ${c.department}` : ""}`}
          href={href(c)}
        />
      ),
    },
    {
      key: "ends",
      header: "Ends",
      sortable: true,
      value: (c) => c.endsOn ?? "",
      render: (c) => <span className="whitespace-nowrap tabular-nums">{formatDate(c.endsOn)}</span>,
    },
    {
      key: "salary",
      header: "Salary",
      hideOnMobile: true,
      sortable: true,
      value: (c) => c.grossSalary ?? -1,
      render: (c) => (c.grossSalary !== null ? salary(c.grossSalary, c.salaryPeriod) : <span className="text-neutral-400">-</span>),
    },
    {
      key: "left",
      header: "Standing",
      sortable: true,
      value: (c) => c.daysRemaining ?? -9999,
      render: (c) => <div className="flex flex-wrap gap-1.5">{chips(c)}</div>,
    },
    { key: "actions", header: "", tableOnly: true, align: "right", render: (c) => actions(c) },
  ];

  return (
    <DataView
      rows={rows}
      columns={columns}
      rowKey={(c) => c.id}
      storageKey={storageKey}
      caption="Agreements"
      searchPlaceholder="Search people or roles"
      empty={empty}
      renderCard={(c) => (
        <div className="flex h-full flex-col gap-4 p-5">
          <PersonCell name={name(c)} sub={c.jobTitle} href={href(c)} size={44} />
          <div className="flex flex-wrap gap-1.5">
            {c.department && <Chip hue={hueFor(c.department)}>{c.department}</Chip>}
            {chips(c)}
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-neutral-50 px-3 py-2">
              <dt className="text-[11px] font-medium text-neutral-500">Ends</dt>
              <dd className="text-sm font-semibold tabular-nums text-neutral-900">{formatDate(c.endsOn)}</dd>
            </div>
            <div className="rounded-xl bg-mint-50 px-3 py-2 text-mint-700">
              <dt className="text-[11px] font-medium opacity-80">Salary</dt>
              <dd className="truncate text-sm font-semibold">
                {c.grossSalary !== null ? salary(c.grossSalary, c.salaryPeriod) : "-"}
              </dd>
            </div>
          </dl>
          <div className="mt-auto border-t border-neutral-100 pt-3">{actions(c)}</div>
        </div>
      )}
      renderListItem={(c) => (
        <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
          <div className="min-w-0 flex-1">
            <PersonCell
              name={name(c)}
              sub={`${c.jobTitle}${c.department ? ` · ${c.department}` : ""} · ends ${formatDate(c.endsOn)}${
                c.grossSalary !== null ? ` · ${salary(c.grossSalary, c.salaryPeriod)}` : ""
              }`}
              href={href(c)}
            />
          </div>
          {chips(c)}
          {actions(c)}
        </div>
      )}
    />
  );
}

function RenewDialog({
  contract,
  onClose,
  onRenewed,
}: {
  contract: EmploymentContract;
  onClose: () => void;
  onRenewed: () => void;
}) {
  const [endsOn, setEndsOn] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [grossSalary, setGrossSalary] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeId = contract.employee?.id;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!employeeId) {
      setError("This agreement is not attached to anybody.");
      return;
    }

    setBusy(true);

    try {
      await hrm.contracts.renew(employeeId, {
        endsOn,
        // Only sent when changed. Everything left blank carries over from the
        // agreement being replaced, re-keying a salary is how a digit goes
        // missing.
        ...(jobTitle.trim() === "" ? {} : { jobTitle: jobTitle.trim() }),
        ...(grossSalary === ""
          ? {}
          : { grossSalary: Math.round(Number(grossSalary) * 100) }),
      });

      onRenewed();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That did not go through.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto p-4 sm:p-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="fixed inset-0 bg-neutral-900/50 backdrop-blur-sm"
      />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-[1.25rem] bg-white p-5 shadow-2xl shadow-neutral-900/10 sm:p-6"
      >
        <h2 className="text-lg font-bold tracking-tight text-neutral-900">
          Renew {contract.employee?.name ?? "this agreement"}
        </h2>
        <p className="text-xs text-neutral-500">
          The current term ends {formatDate(contract.endsOn)}. The new one starts
          the day after, so no day falls between them uncovered.
        </p>

        {error !== null && (
          <Notice tone="error" role="alert" className="mt-4">
            {error}
          </Notice>
        )}

        <label className="mt-5 block">
          <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
            New term ends
          </span>
          <input
            type="date"
            required
            value={endsOn}
            onChange={(e) => setEndsOn(e.target.value)}
            className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
          />
        </label>

        <p className="mt-5 text-xs font-medium text-neutral-700">
          Changing anything? Leave blank to carry the existing terms over.
        </p>

        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
              Job title
            </span>
            <JobTitlePicker
              mode="name"
              value={jobTitle}
              onChange={(name) => setJobTitle(name)}
              placeholder={contract.jobTitle}
              clearable
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-neutral-700">
              Gross salary (₦)
            </span>
            <input
              type="number"
              min={0}
              step={1000}
              value={grossSalary}
              onChange={(e) => setGrossSalary(e.target.value)}
              placeholder={
                contract.grossSalary === null
                  ? "Not set"
                  : String(contract.grossSalary / 100)
              }
              className="w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 outline-none transition placeholder:text-neutral-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-100"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2 border-t border-neutral-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 text-sm font-semibold text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 text-sm font-semibold text-white shadow-sm shadow-primary-600/20 transition-colors hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Renewing…" : "Renew"}
          </button>
        </div>
      </form>
    </div>
  );
}
