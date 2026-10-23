"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CalendarCheck2, CheckCircle2, Download, FileSpreadsheet, Landmark, ListChecks, Plus, Scale, Wallet } from "lucide-react";
import { Button, ButtonLink, Chip, Empty, PageHeader, StatGrid, cx } from "@/components/workspace/kit";
import { Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { banking, errorText, type BankAccount } from "@/lib/api/finance-banking-client";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, compact, day, monthLabel } from "@/suite/finance/lib/format";
import { csvAmount, csvDate, downloadCsv } from "@/components/workspace/csv";
import AddBankAccountDialog from "./AddBankAccountDialog";
import { BANKS, PURPOSES, bookVsBank } from "./labels";
import { BankMark, Money } from "./ui";

/**
 * Bank accounts: one card per account with the ledger beside the bank, the
 * last month reconciled and what is still waiting to be posted; the cash
 * position totalled by currency above them.
 */

interface CurrencyTotal {
  currency: string;
  accounts: number;
  book: number;
  bank: number;
  withStatement: number;
}

export function totalsByCurrency(rows: BankAccount[]): CurrencyTotal[] {
  const by = new Map<string, CurrencyTotal>();
  for (const a of rows) {
    if (a.status === "closed") continue;
    const t = by.get(a.currency) ?? { currency: a.currency, accounts: 0, book: 0, bank: 0, withStatement: 0 };
    t.accounts += 1;
    t.book += a.bookBalance;
    if (a.bankBalance !== null) {
      t.bank += a.bankBalance;
      t.withStatement += 1;
    }
    by.set(a.currency, t);
  }
  // Naira first, then the rest alphabetically.
  return [...by.values()].sort((x, y) => (x.currency === "NGN" ? -1 : y.currency === "NGN" ? 1 : x.currency.localeCompare(y.currency)));
}

export const isLow = (a: BankAccount) => a.lowBalanceThreshold !== null && a.bankBalance !== null && a.bankBalance < a.lowBalanceThreshold;

export default function BankAccountsBoard() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<BankAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let alive = true;
    banking.accounts
      .list()
      .then((r) => {
        if (!alive) return;
        setRows(r);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(`Bank accounts didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [reload]);

  const all = useMemo(() => rows ?? [], [rows]);
  const totals = useMemo(() => totalsByCurrency(all), [all]);
  const unposted = all.reduce((n, a) => n + a.unreconciledCount, 0);
  const low = all.filter(isLow).length;
  const takenGl = useMemo(() => all.map((a) => a.glAccount?.id).filter((x): x is string => !!x), [all]);
  const canAdd = mayDo(user, "banking", "create");

  /* Every account on the board, the number masked as the API gives it. */
  const exportCsv = () =>
    downloadCsv("bank-accounts.csv", [
      ["Account", "Bank", "Number", "Purpose", "Status", "Ledger account", "Currency", "Book balance", "Bank balance", "Bank balance on", "Last reconciled", "Unposted lines", "Unposted value", "Low balance alert"],
      ...all.map((a) => [
        a.name,
        a.bankName ?? BANKS[a.bankCode] ?? a.bankCode,
        a.number,
        PURPOSES[a.purpose] ?? a.purpose,
        a.status === "closed" ? "Closed" : "Active",
        a.glAccount ? `${a.glAccount.code} ${a.glAccount.name}` : "",
        a.currency || "NGN",
        csvAmount(a.bookBalance),
        csvAmount(a.bankBalance),
        csvDate(a.bankBalanceDate),
        csvDate(a.lastReconciled),
        a.unreconciledCount,
        csvAmount(a.unreconciledValue),
        csvAmount(a.lowBalanceThreshold),
      ]),
    ]);

  return (
    <div>
      <PageHeader
        eyebrow="Banking"
        title="Bank accounts"
        subtitle="Every account the bursary runs: what the bank says, what the books say, and what still has to be posted."
        actions={
          <>
            <Button icon={Download} onClick={exportCsv} disabled={all.length === 0}>
              Download CSV
            </Button>
            <ButtonLink href="/suite/finance/banking/imports" icon={FileSpreadsheet}>
              Statements
            </ButtonLink>
            {canAdd && (
              <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                Add bank account
              </Button>
            )}
          </>
        }
      />

      {loadError && <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />}

      {rows === null && !loadError ? (
        <div aria-busy="true" className="space-y-5">
          <p className="sr-only">Loading bank accounts…</p>
          <Skeleton className="h-[132px]" />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Skeleton className="h-[260px]" />
            <Skeleton className="h-[260px]" />
            <Skeleton className="h-[260px]" />
          </div>
        </div>
      ) : rows !== null && rows.length === 0 ? (
        <div className="ws-card">
          <Empty
            icon={Landmark}
            title="No bank accounts yet."
            hint="Add the institution's accounts, then upload a statement to start reconciling."
            action={
              canAdd ? (
                <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                  Add the first account
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : rows !== null ? (
        <>
          <section aria-labelledby="cash-position" className="mb-6">
            <h2 id="cash-position" className="sr-only">
              Cash position by currency
            </h2>
            <StatGrid cols={4}>
              {totals.map((t, i) => (
                <StatCard
                  key={t.currency}
                  featured={i === 0}
                  label={`Cash at bank · ${t.currency}`}
                  value={t.withStatement === 0 ? "-" : compact(t.bank, t.currency)}
                  icon={Wallet}
                  // The bank figure covers only accounts with a statement; say so when that isn't all of them.
                  hint={`Books ${compact(t.book, t.currency)} · ${
                    t.withStatement === t.accounts
                      ? `${t.accounts} ${t.accounts === 1 ? "account" : "accounts"}`
                      : t.withStatement === 0
                        ? "no statement yet"
                        : `statements for ${t.withStatement} of ${t.accounts}`
                  }`}
                />
              ))}
              <StatCard
                label="Lines not yet posted"
                value={unposted}
                icon={ListChecks}
                hue="sun"
                hint={unposted > 0 ? "Review them from each statement" : "Everything is in the books"}
                href={unposted > 0 ? "/suite/finance/banking/imports?status=ready_for_review" : undefined}
              />
              {low > 0 && <StatCard label="Below the low-balance line" value={low} icon={AlertTriangle} hue="rose" hint="Fund these accounts" />}
            </StatGrid>
          </section>

          <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Bank accounts">
            {rows.map((a) => (
              <li key={a.id}>
                <AccountCard account={a} />
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {adding && (
        <AddBankAccountDialog
          takenGlIds={takenGl}
          onClose={() => setAdding(false)}
          onCreated={(a) => {
            setAdding(false);
            router.push(`/suite/finance/banking/${a.id}`);
          }}
        />
      )}
    </div>
  );
}

/** The ledger against the bank, said in words: agrees, higher, lower, or no statement yet. */
export function Agreement({ account }: { account: Pick<BankAccount, "bookBalance" | "bankBalance" | "currency"> }) {
  const diff = bookVsBank(account.bookBalance, account.bankBalance);
  if (diff === null) {
    return (
      <Chip hue="slate" className="!px-2 !py-0.5 !text-[11px]">
        No statement yet
      </Chip>
    );
  }
  if (diff === 0) {
    return (
      <Chip hue="mint" icon={CheckCircle2} className="!px-2 !py-0.5 !text-[11px]">
        Books agree with the bank
      </Chip>
    );
  }
  return (
    <Chip hue="sun" icon={Scale} className="!px-2 !py-0.5 !text-[11px]">
      Books {diff > 0 ? "higher" : "lower"} by {amount(Math.abs(diff), account.currency)}
    </Chip>
  );
}

function AccountCard({ account: a }: { account: BankAccount }) {
  const lowNow = isLow(a);
  return (
    <Link
      href={`/suite/finance/banking/${a.id}`}
      className={cx(
        "ws-card group flex h-full flex-col gap-4 p-5 outline-none transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary-300",
        a.status === "closed" && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <BankMark code={a.bankCode} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold text-neutral-900 group-hover:text-primary-700">{a.name}</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            {a.bankCode === "other" ? (a.bankName ?? BANKS.other) : BANKS[a.bankCode]} · <span className="font-mono">{a.number}</span>
          </p>
        </div>
        <span className="flex shrink-0 flex-col items-end gap-1">
          <Chip hue="slate" className="!px-2 !py-0.5 !text-[11px]">
            {a.currency}
          </Chip>
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip hue="blue" className="!px-2 !py-0.5 !text-[11px]">
          {PURPOSES[a.purpose] ?? a.purpose}
        </Chip>
        {a.status === "closed" && (
          <Chip hue="slate" className="!px-2 !py-0.5 !text-[11px]">
            Closed
          </Chip>
        )}
        {lowNow && (
          <Chip hue="rose" icon={AlertTriangle} className="!px-2 !py-0.5 !text-[11px]">
            Below {amount(a.lowBalanceThreshold, a.currency)}
          </Chip>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="min-w-0">
          <dt className="text-xs font-medium text-neutral-500">Bank says</dt>
          <dd className="mt-0.5 break-words text-lg font-bold tabular-nums tracking-tight text-neutral-900">
            {a.bankBalance === null ? <span className="text-neutral-400">-</span> : <Money value={a.bankBalance} currency={a.currency} />}
          </dd>
          <dd className="text-[11px] text-neutral-500">{a.bankBalanceDate ? `as at ${day(a.bankBalanceDate)}` : "No statement uploaded"}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-xs font-medium text-neutral-500">Books say</dt>
          <dd className="mt-0.5 break-words text-lg font-bold tabular-nums tracking-tight text-neutral-900">
            <Money value={a.bookBalance} currency={a.currency} />
          </dd>
          <dd className="text-[11px] text-neutral-500">{a.glAccount ? `${a.glAccount.code} · ${a.glAccount.name}` : "No ledger account"}</dd>
        </div>
      </dl>

      <Agreement account={a} />

      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-neutral-100 pt-3 text-xs text-neutral-600">
        <span className="inline-flex items-center gap-1.5">
          <CalendarCheck2 size={14} className="text-neutral-400" aria-hidden />
          {a.lastReconciled ? `Reconciled to ${monthLabel(a.lastReconciled.slice(0, 7), true)}` : "Never reconciled"}
        </span>
        <span className={cx("inline-flex items-center gap-1.5 tabular-nums", a.unreconciledCount > 0 && "font-semibold text-sun-700")}>
          {a.unreconciledCount > 0 ? `${a.unreconciledCount} not posted · ${compact(Math.abs(a.unreconciledValue), a.currency)}` : "All posted"}
        </span>
      </div>
    </Link>
  );
}
