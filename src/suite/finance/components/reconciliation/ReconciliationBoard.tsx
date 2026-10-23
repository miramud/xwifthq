"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowUpRight, BadgeCheck, CheckCircle2, ChevronLeft, ChevronRight, ClipboardCheck, FileDown, FileQuestion, FileSpreadsheet, History, Info, Landmark, Lock, LockOpen, NotebookPen, Scale } from "lucide-react";
import { Button, ButtonLink, Card, Chip, PageHeader, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { banking, errorText, type ReconItem, type Reconciliation, type ReconciliationEvent } from "@/lib/api/finance-banking-client";
import ReasonDialog from "../vouchers/ReasonDialog";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, day, monthLabel } from "@/suite/finance/lib/format";
import { RECON_STATUS, isMonthKey, monthKey, monthRange, shiftMonth } from "@/suite/finance/components/banking/labels";

/**
 * A bank reconciliation for one account and month, laid out the way an
 * auditor reads one:
 *
 *   statement closing − unpresented payments + uncredited receipts = adjusted bank
 *   ledger closing ± statement items not yet in the ledger          = adjusted book
 *
 * Balanced when the two agree. Preparing saves the figures under your name;
 * somebody else approves, and only while the figures still stand. Approval
 * locks the month's statement lines.
 */

export default function ReconciliationBoard({ accountId, period }: { accountId: string; period: string }) {
  const { user } = useAuth();
  const [rec, setRec] = useState<Reconciliation | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<null | "prepare" | "approve">(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<ReconciliationEvent[]>([]);
  const [reopening, setReopening] = useState(false);
  const [historyTick, setHistoryTick] = useState(0);
  const valid = isMonthKey(period);
  const recId = rec?.id ?? null;

  /* The sign-off history, once there is something saved to have one. */
  useEffect(() => {
    if (!valid || recId === null) {
      setHistory([]);
      return;
    }
    let alive = true;
    banking.reconciliations
      .history(accountId, period)
      .then((h) => alive && setHistory(h))
      .catch(() => alive && setHistory([]));
    return () => {
      alive = false;
    };
  }, [accountId, period, valid, recId, historyTick]);

  useEffect(() => {
    if (!valid) return;
    let alive = true;
    banking.reconciliations
      .get(accountId, period)
      .then((r) => {
        if (!alive) return;
        setRec(r);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(`This reconciliation didn't load. ${errorText(e)}`));
    return () => {
      alive = false;
    };
  }, [accountId, period, valid, reload]);

  const base = `/suite/finance/banking/${accountId}/reconciliation`;
  const thisMonth = monthKey(new Date());

  if (!valid) {
    return (
      <div>
        <BackLink href={`/suite/finance/banking/${accountId}`} label="Bank account" />
        <ErrorNote>
          “{period}” is not a month. Open a month from the bank account, or go to <Link href={`${base}/${shiftMonth(thisMonth, -1)}`} className="font-semibold underline">last month</Link>.
        </ErrorNote>
      </div>
    );
  }

  const act = async (what: "prepare" | "approve") => {
    setBusy(what);
    setError(null);
    setNotice(null);
    try {
      const r = what === "prepare" ? await banking.reconciliations.prepare(accountId, period) : await banking.reconciliations.approve(accountId, period);
      setRec(r);
      setHistoryTick((k) => k + 1);
      setNotice(
        what === "approve"
          ? `Approved. ${monthLabel(period)} is locked: its statement lines can no longer change.`
          : r.status === "balanced"
            ? "Prepared and balanced. Somebody else can now approve it."
            : "Prepared, with a difference still to clear. Clear it, then prepare again.",
      );
    } catch (e) {
      setError(errorText(e));
      setReload((k) => k + 1);
    } finally {
      setBusy(null);
    }
  };

  const nav = (
    <div className="flex items-center gap-1" aria-label="Month">
      <Link href={`${base}/${shiftMonth(period, -1)}`} aria-label={`Previous month, ${monthLabel(shiftMonth(period, -1))}`} className={buttonClass("secondary", "md") + " !px-3"}>
        <ChevronLeft size={17} aria-hidden />
      </Link>
      <span className="min-w-[8.5rem] text-center text-sm font-semibold text-neutral-800">{monthLabel(period)}</span>
      <Link
        href={`${base}/${shiftMonth(period, 1)}`}
        aria-label={`Next month, ${monthLabel(shiftMonth(period, 1))}`}
        aria-disabled={period >= thisMonth}
        className={cx(buttonClass("secondary", "md"), "!px-3", period >= thisMonth && "pointer-events-none opacity-40")}
        tabIndex={period >= thisMonth ? -1 : undefined}
      >
        <ChevronRight size={17} aria-hidden />
      </Link>
    </div>
  );

  if (loadError && rec === null) {
    return (
      <div>
        <BackLink href={`/suite/finance/banking/${accountId}`} label="Bank account" />
        <LoadError text={loadError} onRetry={() => setReload((k) => k + 1)} />
      </div>
    );
  }

  if (rec === null) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the reconciliation…</p>
        <Skeleton className="h-20" />
        <Skeleton className="h-[320px]" />
      </div>
    );
  }

  const r = rec;
  const cur = r.bankAccount.currency;
  const m = (v: number | null | undefined) => amount(v, cur);
  const approved = r.status === "approved";
  const stale = !approved && r.id !== null && !r.prepared;
  const balanced = r.difference === 0 && r.statementClosing !== null;
  const notInLedgerNet = (r.detail?.notInLedger ?? []).reduce((s, l) => s + l.amount, 0);
  const iPrepared = !!user && r.preparedBy !== null && r.preparedBy === user.name;
  const canPrepare = mayDo(user, "reconciliation", "prepare") && !approved;
  const canApprove = mayDo(user, "reconciliation", "approve") && !approved;
  const approveBlock = !r.prepared
    ? "Prepare it first."
    : r.status !== "balanced"
      ? "Only a balanced reconciliation can be approved."
      : iPrepared
        ? "You prepared it; somebody else has to approve it."
        : null;
  const statusMeta = RECON_STATUS[r.prepared || approved ? r.status : "none"];
  // Reopening: a finance manager, never the approver (the API says so too).
  const iApproved = !!user && approved && (r.approvedById ? r.approvedById === user.id : r.approvedBy === user.name);
  const canReopen = approved && mayDo(user, "reconciliation", "reopen");

  return (
    <div>
      <BackLink href={`/suite/finance/banking/${accountId}`} label={r.bankAccount.name} />
      <PageHeader
        eyebrow={`${r.bankAccount.name} · ${cur}`}
        title={`Reconciliation, ${monthLabel(period)}`}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <Chip hue={statusMeta.hue} icon={approved ? Lock : r.prepared ? ClipboardCheck : FileQuestion}>
              {statusMeta.label}
            </Chip>
            {r.preparedBy && r.prepared && <span>Prepared by {r.preparedBy}</span>}
            {approved && r.approvedBy && <span>· approved by {r.approvedBy}{r.approvedAt ? ` on ${day(r.approvedAt)}` : ""}</span>}
          </span>
        }
        actions={
          <>
            {nav}
            {canPrepare && (
              <Button icon={ClipboardCheck} disabled={busy !== null} onClick={() => void act("prepare")} variant={r.prepared ? "secondary" : "primary"}>
                {busy === "prepare" ? "Preparing…" : r.id !== null ? "Prepare again" : "Prepare"}
              </Button>
            )}
            {canApprove && r.prepared && (
              <Button icon={BadgeCheck} variant="primary" disabled={busy !== null || approveBlock !== null} onClick={() => void act("approve")} title={approveBlock ?? undefined}>
                {busy === "approve" ? "Approving…" : "Approve"}
              </Button>
            )}
            {canReopen && (
              <Button
                icon={LockOpen}
                disabled={busy !== null || iApproved}
                onClick={() => setReopening(true)}
                title={iApproved ? "You approved it; another finance manager has to reopen it." : undefined}
              >
                Reopen
              </Button>
            )}
          </>
        }
      />

      {/* The report, as an auditor keeps it: PDF with the sign-off, or the same as CSV. */}
      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Download the reconciliation report">
        <a href={banking.reconciliations.pdfUrl(accountId, period)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
          <FileDown size={15} aria-hidden />
          Download report (PDF)
        </a>
        <a href={banking.reconciliations.csvUrl(accountId, period)} download className={buttonClass("ghost", "sm")}>
          <FileSpreadsheet size={15} aria-hidden />
          CSV
        </a>
        {canReopen && iApproved && <span className="text-xs text-neutral-500">You approved this month, so another finance manager has to reopen it.</span>}
      </div>

      {reopening && (
        <ReasonDialog
          title={`Reopen ${monthLabel(period)}?`}
          subtitle="The approval is withdrawn and the month's statement lines can change again. It stays in the history, with your reason, and the month has to be approved afresh."
          label="Why it is reopened"
          confirmLabel="Reopen reconciliation"
          busyLabel="Reopening…"
          tone="danger"
          onConfirm={async (reason) => {
            const next = await banking.reconciliations.reopen(accountId, period, reason);
            setRec(next);
            setReopening(false);
            setHistoryTick((k) => k + 1);
            setError(null);
            setNotice(`Reopened. ${monthLabel(period)}'s statement lines can change again; prepare and approve it once they are right.`);
          }}
          onClose={() => setReopening(false)}
        />
      )}

      {error && <ErrorNote className="mb-4">{error}</ErrorNote>}
      {notice && (
        <p role="status" className="mb-4 rounded-xl bg-mint-50 px-4 py-3 text-sm text-mint-700">
          {notice}
        </p>
      )}
      {stale && (
        <p className="mb-4 flex gap-2 rounded-xl bg-sun-50 px-4 py-3 text-sm text-sun-700">
          <Info size={16} className="mt-0.5 shrink-0" aria-hidden />
          The figures have changed since this month was last prepared. Prepare it again before anyone approves it.
        </p>
      )}
      {canApprove && r.prepared && approveBlock && (
        <p className="mb-4 text-xs text-neutral-500">Approve: {approveBlock}</p>
      )}

      {r.statementClosing === null && (
        <p className="mb-4 flex flex-wrap items-center gap-2 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          <FileQuestion size={16} aria-hidden />
          No statement covers {monthLabel(period)} yet, so there is nothing to reconcile against.
          <Link href={`/suite/finance/banking/${accountId}`} className="font-semibold text-primary-700 underline-offset-2 hover:underline">
            Upload the statement
          </Link>
        </p>
      )}

      {/* The difference first, big: it is the whole point. */}
      <Card className={cx("mb-5 overflow-hidden", balanced ? "!border-mint-100" : "!border-rose-100")}>
        <div className="grid gap-0 lg:grid-cols-[1fr_auto_1fr]">
          <Side
            title="Bank"
            icon={Landmark}
            rows={[
              { label: `Statement closing balance${r.detail?.lastStatementDate ? `, ${day(r.detail.lastStatementDate)}` : ""}`, value: r.statementClosing, strong: true },
              { label: "Less: payments in the books, not yet on the statement", value: -r.unpresentedPayments },
              { label: "Add: receipts in the books, not yet on the statement", value: r.uncreditedReceipts },
            ]}
            total={{ label: "Adjusted bank balance", value: r.detail?.adjustedBank ?? null }}
            m={m}
          />
          <div className={cx("flex flex-col items-center justify-center gap-1 px-8 py-6 text-center", balanced ? "bg-mint-50" : "bg-rose-50")} aria-live="polite">
            <span className={cx("flex h-11 w-11 items-center justify-center rounded-2xl", balanced ? "bg-white text-mint-700" : "bg-white text-rose-700")}>
              {balanced ? <CheckCircle2 size={22} aria-hidden /> : <Scale size={22} aria-hidden />}
            </span>
            <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Difference</p>
            <p className={cx("text-[34px] font-bold leading-none tracking-tight tabular-nums", balanced ? "text-mint-700" : "text-rose-700")}>{m(r.difference)}</p>
            <p className={cx("text-sm font-semibold", balanced ? "text-mint-700" : "text-rose-700")}>{balanced ? "Balanced" : r.statementClosing === null ? "No statement" : "Not balanced"}</p>
          </div>
          <Side
            title="Books"
            icon={NotebookPen}
            rows={[
              { label: `Ledger closing balance, ${day(monthRange(period).to)}`, value: r.glClosing, strong: true },
              { label: "Add or less: statement items not yet in the books", value: notInLedgerNet },
            ]}
            total={{ label: "Adjusted book balance", value: r.detail?.adjustedBook ?? null }}
            m={m}
          />
        </div>
      </Card>

      <div className="grid gap-5 xl:grid-cols-3">
        <ItemsPanel title="Payments not yet on the statement" subtitle="Unpresented: in the books, not yet through the bank" icon={ArrowUpRight} hue="coral" items={r.detail?.unpresented ?? []} m={m} empty="None. Every payment in the books is on the statement." />
        <ItemsPanel title="Receipts not yet on the statement" subtitle="Uncredited: in the books, not yet through the bank" icon={ArrowDownLeft} hue="mint" items={r.detail?.uncredited ?? []} m={m} empty="None. Every receipt in the books is on the statement." />
        <Panel title="On the statement, not in the books" subtitle="Classify and post these from the statement" icon={FileQuestion} hue="sun" bodyClassName="p-0">
          {(r.detail?.notInLedger ?? []).length === 0 ? (
            <p className="px-5 pb-5 pt-3 text-sm text-neutral-500">None. Every statement line is in the books.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-neutral-100 overflow-y-auto">
              {r.detail?.notInLedger.map((l) => (
                <li key={l.lineId} className="flex items-start justify-between gap-3 px-5 py-3">
                  <span className="min-w-0">
                    <span className="block break-words text-sm text-neutral-800">{l.narration}</span>
                    <span className="block text-xs text-neutral-500">{day(l.date)}</span>
                  </span>
                  <span className={cx("shrink-0 text-sm font-semibold tabular-nums", l.amount < 0 ? "text-coral-700" : "text-mint-700")}>
                    {l.amount < 0 ? "−" : "+"}
                    {accounting(Math.abs(l.amount))}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {(r.detail?.notInLedger ?? []).length > 0 && (
            <div className="border-t border-neutral-100 px-5 py-3">
              <ButtonLink href={`/suite/finance/banking/imports?status=ready_for_review`} size="sm">
                Review statements
              </ButtonLink>
            </div>
          )}
        </Panel>
      </div>

      {history.length > 0 && <SignOffHistory events={history} m={m} />}

      <Panel title="How approval works" icon={Info} hue="sky" className="mt-5">
        <ul className="grid gap-3 text-sm text-neutral-600 md:grid-cols-4">
          <li>
            <span className="block font-semibold text-neutral-900">Prepare</span>
            Saves today&apos;s figures under your name. Prepare again whenever something changes.
          </li>
          <li>
            <span className="block font-semibold text-neutral-900">Approve</span>
            Somebody other than the preparer approves, only when the difference is nil and nothing has moved since it was prepared.
          </li>
          <li>
            <span className="block font-semibold text-neutral-900">Locked</span>
            Once approved, the month&apos;s statement lines are read-only.
          </li>
          <li>
            <span className="block font-semibold text-neutral-900">Reopen</span>
            A finance manager other than the approver can take it back to prepared, with a reason, while the month is open. The approval stays in the history.
          </li>
        </ul>
      </Panel>
    </div>
  );
}

const EVENT_META: Record<ReconciliationEvent["action"], { label: string; icon: typeof Landmark; tone: string }> = {
  prepared: { label: "Prepared", icon: ClipboardCheck, tone: "bg-sky-50 text-sky-700" },
  approved: { label: "Approved", icon: BadgeCheck, tone: "bg-mint-50 text-mint-700" },
  reopened: { label: "Reopened", icon: LockOpen, tone: "bg-sun-50 text-sun-700" },
};

/** Who prepared, approved and reopened it, newest first: the audit trail an auditor asks for. */
function SignOffHistory({ events, m }: { events: ReconciliationEvent[]; m: (v: number | null | undefined) => string }) {
  return (
    <Panel title="Sign-off history" subtitle="Kept for audit, including approvals later withdrawn" icon={History} hue="grape" className="mt-5">
      <ol className="relative space-y-4 border-l border-neutral-200 pl-6" aria-label="Sign-off history, newest first">
        {events.map((e) => {
          const meta = EVENT_META[e.action] ?? EVENT_META.prepared;
          const Icon = meta.icon;
          return (
            <li key={e.id} className="relative">
              <span className={cx("absolute -left-[2.15rem] top-0 flex h-7 w-7 items-center justify-center rounded-full ring-4 ring-white", meta.tone)} aria-hidden>
                <Icon size={14} />
              </span>
              <p className="text-sm text-neutral-800">
                <span className="font-semibold text-neutral-900">{meta.label}</span> by {e.by ?? "somebody no longer here"}
                {e.at && <span className="text-neutral-500"> · {new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
              </p>
              {e.action !== "reopened" && e.difference !== null && <p className="text-xs text-neutral-500">Difference at the time: {m(e.difference)}</p>}
              {e.reason && <p className="mt-1 rounded-lg bg-neutral-50 px-3 py-2 text-sm text-neutral-700">“{e.reason}”</p>}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}

function Side({
  title,
  icon: Icon,
  rows,
  total,
  m,
}: {
  title: string;
  icon: typeof Landmark;
  rows: { label: string; value: number | null; strong?: boolean }[];
  total: { label: string; value: number | null };
  m: (v: number | null | undefined) => string;
}) {
  return (
    <div className="p-5 sm:p-6">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-neutral-900">
        <Icon size={17} className="text-neutral-400" aria-hidden />
        {title}
      </h2>
      <dl className="space-y-2.5 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4">
            <dt className={r.strong ? "font-medium text-neutral-800" : "text-neutral-600"}>{r.label}</dt>
            <dd className={cx("shrink-0 tabular-nums", r.strong ? "font-semibold text-neutral-900" : "text-neutral-700")}>{r.value === null ? "—" : m(r.value)}</dd>
          </div>
        ))}
        <div className="flex items-baseline justify-between gap-4 border-t-2 border-neutral-900/80 pt-2.5">
          <dt className="font-semibold text-neutral-900">{total.label}</dt>
          <dd className="shrink-0 text-base font-bold tabular-nums text-neutral-900">{total.value === null ? "—" : m(total.value)}</dd>
        </div>
      </dl>
    </div>
  );
}

function ItemsPanel({
  title,
  subtitle,
  icon,
  hue,
  items,
  m,
  empty,
}: {
  title: string;
  subtitle: string;
  icon: typeof Landmark;
  hue: "coral" | "mint";
  items: ReconItem[];
  m: (v: number) => string;
  empty: string;
}) {
  const total = items.reduce((s, i) => s + i.amount, 0);
  return (
    <Panel title={title} subtitle={subtitle} icon={icon} hue={hue} bodyClassName="p-0" actions={items.length > 0 ? <span className="text-sm font-semibold tabular-nums text-neutral-900">{m(total)}</span> : undefined}>
      {items.length === 0 ? (
        <p className="px-5 pb-5 pt-3 text-sm text-neutral-500">{empty}</p>
      ) : (
        <ul className="max-h-[420px] divide-y divide-neutral-100 overflow-y-auto">
          {items.map((i) => (
            <li key={`${i.journalId}-${i.amount}`}>
              <Link href={`/suite/finance/journals/${i.journalId}`} className="flex items-start justify-between gap-3 px-5 py-3 outline-none hover:bg-neutral-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-300">
                <span className="min-w-0">
                  <span className="block truncate text-sm text-neutral-800">{i.narration ?? "Journal"}</span>
                  <span className="block text-xs text-neutral-500">
                    {i.journalNo ?? "Journal"} · {day(i.date)}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-neutral-900">{m(i.amount)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
