"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { CalendarCheck2, CalendarRange, FileSpreadsheet, Landmark, ListChecks, Lock, LockOpen, Pencil, Scale, UploadCloud, Wallet } from "lucide-react";
import { Button, ButtonLink, Chip, Empty, PageHeader, Panel, Segmented, StatGrid } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { DataView, type Column } from "@/components/workspace/DataView";
import { BackLink, ErrorNote, Skeleton, StatCard, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { banking, errorText, type BankAccountDetail as Detail, type StatementAnalysis, type StatementSummary } from "@/lib/api/finance-banking-client";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import AnalysisView from "@/suite/finance/components/statements/AnalysisView";
import { Agreement } from "./BankAccountsBoard";
import EditBankAccountDialog from "./EditBankAccountDialog";
import ReconciliationStrip from "./ReconciliationStrip";
import StatementUpload from "./StatementUpload";
import { BANKS, PURPOSES, bookVsBank, monthKey, monthRange, shiftMonth } from "./labels";
import { BankMark, ImportStatusChip, Money, VerifiedBadge } from "./ui";

/**
 * One bank account: its balances, the statements uploaded for it (and the
 * place to upload the next), twelve months of reconciliation, and an analysis
 * of any range.
 */

type Range = "latest" | "quarter" | "year" | "custom";

/** The analysis range for a preset, anchored on the month of the latest statement line. */
export function rangeFor(preset: Exclude<Range, "custom">, anchorMonth: string): { from: string; to: string } {
  const back = preset === "latest" ? 0 : preset === "quarter" ? 2 : 11;
  return { from: monthRange(shiftMonth(anchorMonth, -back)).from, to: monthRange(anchorMonth).to };
}

export default function BankAccountDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const uid = useId();
  const [account, setAccount] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [range, setRange] = useState<Range>("latest");
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [analysis, setAnalysis] = useState<StatementAnalysis | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const confirm = useConfirm();
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    banking.accounts
      .get(id)
      .then((a) => {
        if (!alive) return;
        setAccount(a);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(`This bank account didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const thisMonth = monthKey(new Date());
  const anchor = account?.bankBalanceDate?.slice(0, 7) ?? thisMonth;
  const window_ = useMemo(() => (range === "custom" ? custom : rangeFor(range, anchor)), [range, custom, anchor]);
  const windowOk = window_.from !== "" && window_.to !== "" && window_.from <= window_.to;

  useEffect(() => {
    if (account === null || !windowOk) return;
    let alive = true;
    banking.accounts
      .analysis(account.id, window_.from, window_.to)
      .then((a) => {
        if (!alive) return;
        setAnalysis(a);
        setAnalysisError(null);
      })
      .catch((e: unknown) => alive && setAnalysisError(`The analysis didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [account, window_, windowOk]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError) {
    return (
      <div>
        <BackLink href="/suite/finance/banking" label="Bank accounts" />
        <LoadError text={loadError} onRetry={refresh} />
      </div>
    );
  }

  if (account === null) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the bank account…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[132px]" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const a = account;
  const diff = bookVsBank(a.bookBalance, a.bankBalance);
  const canUpload = mayDo(user, "statements", "upload");
  const canEdit = mayDo(user, "banking", "update");
  const closed = a.status === "closed";

  const setStatus = async (status: "active" | "closed") => {
    const ok = await confirm(
      status === "closed"
        ? {
            title: `Close ${a.name}?`,
            body: "It is marked closed. Its balances, statements and reconciliations stay, and its final statement can still be uploaded. You can reopen it later.",
            confirmLabel: "Close account",
            tone: "danger",
          }
        : { title: `Reopen ${a.name}?`, body: "It is marked active again.", confirmLabel: "Reopen account", tone: "primary" },
    );
    if (!ok) return;
    setStatusBusy(true);
    setStatusError(null);
    try {
      await banking.accounts.update(a.id, { status });
      setNotice(status === "closed" ? `${a.name} closed.` : `${a.name} reopened.`);
      refresh();
    } catch (e) {
      setStatusError(`The account wasn't ${status === "closed" ? "closed" : "reopened"}. ${errorText(e)}`);
    } finally {
      setStatusBusy(false);
    }
  };
  const lastMonth = shiftMonth(thisMonth, -1);

  const columns: Column<StatementSummary>[] = [
    {
      key: "period",
      header: "Period",
      primary: true,
      sortable: true,
      value: (i) => i.periodFrom ?? i.uploadedAt ?? "",
      render: (i) => (
        <span className="block min-w-0">
          <span className="block font-medium text-neutral-900">{i.periodFrom ? `${day(i.periodFrom)} to ${day(i.periodTo)}` : "Period not read"}</span>
          <span className="block truncate text-xs text-neutral-500">{i.fileName}</span>
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (i) => i.status,
      render: (i) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <ImportStatusChip status={i.status} />
          <VerifiedBadge verified={i.verified} />
        </span>
      ),
    },
    { key: "lines", header: "Lines", align: "right", sortable: true, value: (i) => i.lineCount, render: (i) => <span className="tabular-nums">{i.lineCount} <span className="text-neutral-500">({i.newLineCount} new)</span></span>, hideOnMobile: true },
    { key: "closing", header: "Closing", align: "right", sortable: true, value: (i) => i.closing ?? 0, render: (i) => <Money value={i.closing} currency={a.currency} /> },
    { key: "uploaded", header: "Uploaded", sortable: true, value: (i) => i.uploadedAt ?? "", render: (i) => <span className="text-neutral-600">{i.uploadedAt ? day(i.uploadedAt) : "-"}{i.uploadedBy ? ` · ${i.uploadedBy}` : ""}</span>, hideOnMobile: true },
  ];

  return (
    <div>
      <BackLink href="/suite/finance/banking" label="Bank accounts" />
      <PageHeader
        eyebrow={`${a.bankCode === "other" ? (a.bankName ?? BANKS.other) : BANKS[a.bankCode]} · ${a.number}`}
        title={
          <span className="flex items-center gap-3">
            <BankMark code={a.bankCode} size={36} />
            {a.name}
          </span>
        }
        subtitle={`${PURPOSES[a.purpose] ?? a.purpose} account in ${a.currency}${a.glAccount ? `, posting to ${a.glAccount.code} · ${a.glAccount.name}` : ""}.`}
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {closed && <Chip hue="slate" icon={Lock}>Closed</Chip>}
            {canEdit && (
              <Button icon={Pencil} onClick={() => setEditing(true)} disabled={statusBusy}>
                Edit account
              </Button>
            )}
            {canEdit &&
              (closed ? (
                <Button variant="ghost" icon={LockOpen} onClick={() => setStatus("active")} disabled={statusBusy}>
                  Reopen account
                </Button>
              ) : (
                <Button variant="ghost" icon={Lock} onClick={() => setStatus("closed")} disabled={statusBusy}>
                  {statusBusy ? "Closing…" : "Close account"}
                </Button>
              ))}
            <ButtonLink href={`/suite/finance/banking/${a.id}/reconciliation/${lastMonth}`} icon={Scale}>
              Reconcile {monthLabel(lastMonth, true)}
            </ButtonLink>
          </span>
        }
      />
      <Notice text={notice} />
      {statusError && <ErrorNote className="mb-5">{statusError}</ErrorNote>}
      {editing && (
        <EditBankAccountDialog
          account={a}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setNotice("Account details saved.");
            refresh();
          }}
        />
      )}

      <div className="mb-5">
        <StatGrid cols={4}>
          <StatCard featured label="Bank says" value={a.bankBalance === null ? "-" : compact(a.bankBalance, a.currency)} icon={Landmark} hint={a.bankBalanceDate ? `as at ${day(a.bankBalanceDate)}` : "No statement yet"} />
          <StatCard label="Books say" value={compact(a.bookBalance, a.currency)} icon={Wallet} hue="sky" hint={amount(a.bookBalance, a.currency)} />
          <StatCard
            label="Difference"
            value={diff === null ? "-" : compact(Math.abs(diff), a.currency)}
            icon={Scale}
            hue={diff === 0 ? "mint" : "sun"}
            hint={<Agreement account={a} />}
          />
          <StatCard
            label="Not yet posted"
            value={a.unreconciledCount}
            icon={ListChecks}
            hue="coral"
            hint={a.lastReconciled ? `Reconciled to ${monthLabel(a.lastReconciled.slice(0, 7), true)}` : "Never reconciled"}
          />
        </StatGrid>
      </div>

      <div className="mb-5 grid gap-5 xl:grid-cols-3">
        <Panel title="Statements" subtitle="Every file uploaded for this account" icon={FileSpreadsheet} className="xl:col-span-2" bodyClassName="p-5 pt-4">
          <DataView
            rows={a.imports}
            columns={columns}
            rowKey={(i) => i.id}
            rowHref={(i) => `/suite/finance/banking/imports/${i.id}`}
            views={["table", "list"]}
            storageKey="finance.account.imports"
            caption={`Statements for ${a.name}`}
            searchPlaceholder="Search statements"
            empty={<Empty icon={FileSpreadsheet} title="No statements yet." hint="Upload this account's latest statement to start reviewing and reconciling." />}
          />
        </Panel>
        <Panel title="Upload a statement" icon={UploadCloud} hue="mint">
          {canUpload ? (
            <StatementUpload account={a} onSettled={refresh} canRetry={mayDo(user, "statements", "retry")} />
          ) : (
            <p className="text-sm text-neutral-500">You can see this account&apos;s statements, but uploading needs the Finance permission to upload statements. Ask a Finance admin.</p>
          )}
        </Panel>
      </div>

      <Panel title="Reconciliation, last 12 months" subtitle="Open a month to prepare or approve it" icon={CalendarCheck2} hue="grape" className="mb-5">
        <ReconciliationStrip accountId={a.id} reconciliations={a.reconciliations} endMonth={thisMonth} />
      </Panel>

      <section aria-labelledby={`${uid}-analysis`}>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 id={`${uid}-analysis`} className="text-lg font-bold tracking-tight text-neutral-900">
              Analysis
            </h2>
            <p className="text-sm text-neutral-500">
              {windowOk ? `${day(window_.from)} to ${day(window_.to)}` : "Choose a range"}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <Segmented
              label="Analysis range"
              value={range}
              onChange={(r) => {
                if (r === "custom" && custom.from === "") setCustom(rangeFor("latest", anchor));
                setRange(r);
              }}
              options={[
                { key: "latest", label: monthLabel(anchor, true) },
                { key: "quarter", label: "3 months" },
                { key: "year", label: "12 months" },
                { key: "custom", label: "Custom" },
              ]}
            />
            {range === "custom" && (
              <span className="flex items-end gap-2">
                <label className="text-xs font-medium text-neutral-600">
                  From
                  <input type="date" value={custom.from} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className={`${inputClass} mt-1 !h-9 w-[150px]`} />
                </label>
                <label className="text-xs font-medium text-neutral-600">
                  To
                  <input type="date" value={custom.to} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className={`${inputClass} mt-1 !h-9 w-[150px]`} />
                </label>
              </span>
            )}
          </div>
        </div>
        {!windowOk ? (
          <ErrorNote>
            <CalendarRange size={14} className="mr-1 inline align-[-2px]" aria-hidden />
            Choose a start date on or before the end date.
          </ErrorNote>
        ) : analysisError ? (
          <ErrorNote>{analysisError}</ErrorNote>
        ) : analysis === null ? (
          <Skeleton className="h-[420px]" />
        ) : (
          <AnalysisView data={analysis} threshold={a.lowBalanceThreshold} />
        )}
      </section>
    </div>
  );
}
