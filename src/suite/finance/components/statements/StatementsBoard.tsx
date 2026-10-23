"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, FileCheck2, FileSpreadsheet, FileWarning, Landmark, Send } from "lucide-react";
import { ButtonLink, Empty, PageHeader, StatGrid } from "@/components/workspace/kit";
import { DataView, type Column } from "@/components/workspace/DataView";
import { SearchableSelect } from "@/components/workspace/SearchableSelect";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { banking, errorText, type BankAccount, type ImportStatus, type StatementSummary } from "@/lib/api/finance-banking-client";
import { day } from "@/suite/finance/lib/format";
import { IMPORT_STATUS } from "@/suite/finance/components/banking/labels";
import { ImportStatusChip, Money, VerifiedBadge } from "@/suite/finance/components/banking/ui";

/**
 * Every statement uploaded, across the accounts: what state each is in and
 * whether it passed its checks. Filter by account and status; open one to
 * review it.
 */

const STATUSES = Object.keys(IMPORT_STATUS) as ImportStatus[];

export default function StatementsBoard({ initialStatus = "", initialAccount = "" }: { initialStatus?: string; initialAccount?: string }) {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [rows, setRows] = useState<StatementSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [accountId, setAccountId] = useState(initialAccount);
  const [status, setStatus] = useState<string>(STATUSES.includes(initialStatus as ImportStatus) ? initialStatus : "");

  useEffect(() => {
    let alive = true;
    banking.accounts.list().then((r) => alive && setAccounts(r), () => undefined);
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    banking.statements
      .list({ bankAccountId: accountId || undefined, status: (status || undefined) as ImportStatus | undefined })
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(`Statements didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [accountId, status, reload]);

  const currencyOf = useMemo(() => new Map(accounts.map((a) => [a.id, a.currency])), [accounts]);
  const count = (s: ImportStatus) => (rows ?? []).filter((r) => r.status === s).length;
  const filtered = accountId !== "" || status !== "";

  const columns: Column<StatementSummary>[] = [
    {
      key: "account",
      header: "Account",
      primary: true,
      sortable: true,
      value: (i) => `${i.bankAccount ?? ""} ${i.fileName}`,
      render: (i) => (
        <span className="block min-w-0">
          <span className="block font-medium text-neutral-900">{i.bankAccount ?? "Bank account"}</span>
          <span className="block max-w-[260px] truncate text-xs text-neutral-500">{i.fileName}</span>
        </span>
      ),
    },
    { key: "period", header: "Period", sortable: true, value: (i) => i.periodFrom ?? "", render: (i) => (i.periodFrom ? `${day(i.periodFrom)} to ${day(i.periodTo)}` : <span className="text-neutral-400">Not read</span>) },
    {
      key: "status",
      header: "Status",
      sortable: true,
      value: (i) => IMPORT_STATUS[i.status]?.label ?? i.status,
      render: (i) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <ImportStatusChip status={i.status} />
          <VerifiedBadge verified={i.verified} />
        </span>
      ),
    },
    { key: "lines", header: "Lines", align: "right", sortable: true, value: (i) => i.lineCount, hideOnMobile: true, render: (i) => <span className="tabular-nums">{i.lineCount}</span> },
    { key: "closing", header: "Closing balance", align: "right", sortable: true, value: (i) => i.closing ?? 0, render: (i) => <Money value={i.closing} currency={i.currency ?? currencyOf.get(i.bankAccountId) ?? "NGN"} /> },
    { key: "uploaded", header: "Uploaded", sortable: true, hideOnMobile: true, value: (i) => i.uploadedAt ?? "", render: (i) => <span className="text-neutral-600">{i.uploadedAt ? day(i.uploadedAt) : "-"}{i.uploadedBy ? ` · ${i.uploadedBy}` : ""}</span> },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Banking"
        title="Statements"
        subtitle="Every bank statement uploaded: checked, reviewed, sent for approval and posted."
        actions={
          <ButtonLink href="/suite/finance/banking" variant="primary" icon={Landmark}>
            Upload from an account
          </ButtonLink>
        }
      />

      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}

      {!filtered && (
        <div className="mb-5">
          <StatGrid cols={4}>
            <StatCard featured label="Ready for review" value={rows ? count("ready_for_review") : "-"} icon={Clock} hint="Classify the lines, then propose journals" />
            <StatCard label="Failed checks" value={rows ? count("failed_validation") : "-"} icon={FileWarning} hue="rose" hint="Open one to see why" />
            <StatCard label="Sent for approval" value={rows ? count("submitted") : "-"} icon={Send} hue="grape" />
            <StatCard label="Posted" value={rows ? count("posted") : "-"} icon={FileCheck2} hue="mint" />
          </StatGrid>
        </div>
      )}

      {rows === null && !loadError ? (
        <div aria-busy="true">
          <p className="sr-only">Loading statements…</p>
          <Skeleton className="h-[360px]" />
        </div>
      ) : rows !== null ? (
        <DataView
          rows={rows}
          columns={columns}
          rowKey={(i) => i.id}
          rowHref={(i) => `/suite/finance/banking/imports/${i.id}`}
          views={["table", "list"]}
          storageKey="finance.statements"
          caption="Bank statements"
          searchPlaceholder="Search by account or file"
          toolbar={
            <div className="flex flex-wrap gap-2">
              <SearchableSelect
                aria-label="Bank account"
                size="sm"
                className="w-[220px]"
                value={accountId}
                onChange={setAccountId}
                clearable
                clearLabel="All accounts"
                placeholder="All accounts"
                options={accounts.map((a) => ({ value: a.id, label: a.name, hint: `${a.number} · ${a.currency}` }))}
              />
              <SearchableSelect
                aria-label="Status"
                size="sm"
                className="w-[200px]"
                value={status}
                onChange={setStatus}
                clearable
                clearLabel="Any status"
                placeholder="Any status"
                options={STATUSES.map((s) => ({ value: s, label: IMPORT_STATUS[s].label }))}
              />
            </div>
          }
          empty={
            filtered ? (
              <Empty icon={FileSpreadsheet} title="No statements match." hint="Try another account or status." />
            ) : (
              <Empty
                icon={FileSpreadsheet}
                title="No statements uploaded yet."
                hint="Open a bank account and upload its statement. It is checked line by line before anything reaches the books."
                action={
                  <ButtonLink href="/suite/finance/banking" icon={Landmark}>
                    Go to bank accounts
                  </ButtonLink>
                }
              />
            )
          }
        />
      ) : null}
    </div>
  );
}
