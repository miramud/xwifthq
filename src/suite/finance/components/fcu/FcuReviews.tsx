"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Building2, ClipboardCheck, FileStack, History, Info, Landmark, ListOrdered, MessageCircleQuestion, PiggyBank, ReceiptText, Stamp, UserRound } from "lucide-react";
import { ButtonLink, Card, Chip, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { BackLink, ErrorNote, InfoList, InfoRow, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { orgFoundations } from "@/lib/api/org-foundations-client";
import { banking } from "@/lib/api/finance-banking-client";
import { useAuth } from "@/lib/auth-store";
import {
  spend,
  spendError,
  type MemoFull,
  type Retirement,
  type ReviewOutcome,
  type SpendQuery,
  type VoucherFull,
} from "@/lib/api/finance-spend-client";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { amount, day } from "@/suite/finance/lib/format";
import { useLookup } from "@/suite/finance/components/banking/lookups";
import { Figure, Money } from "@/suite/finance/components/banking/ui";
import { ChecklistDocuments, DocumentList, FundsSnapshotView, HistoryTimeline, MemoStatusChip, QueryThreads, ReviewList } from "@/suite/finance/components/requests/ui";
import { MemoFacts, MemoSummaryCard } from "@/suite/finance/components/requests/MemoParts";
import { PAYEE_SOURCE, memoStatus, memoType, retirementStatus, retirementSum, voucherStatus } from "@/suite/finance/components/requests/labels";
import { ReviewPanel, type ChecklistItem, type ReviewKind } from "./ReviewChecklist";
import { RichTextView } from "@/components/workspace/RichTextView";

/*
  The FCU's three review screens - a memo (checkpoint 1), a voucher (2) and
  an advance retirement (4) - in one layout: the document on the left,
  everything needed to judge it in one place; the checklist on the right,
  staying in view as the document scrolls.
*/

/* ------------------------------------------------------------------ */
/*  Shared                                                             */
/* ------------------------------------------------------------------ */

/** The checkpoint's items, from the API (`FcuChecklist::ITEMS`). */
export function useChecklist(checkpoint: 1 | 2 | 3 | 4): { items: ChecklistItem[] | null; error: string | null } {
  const [state, setState] = useState<{ items: ChecklistItem[] | null; error: string | null }>({ items: null, error: null });
  useEffect(() => {
    let alive = true;
    spend.fcu.queues().then(
      (q) => alive && setState({ items: Object.entries(q.checklists[String(checkpoint)] ?? {}).map(([code, label]) => ({ code, label })), error: null }),
      (e: unknown) => alive && setState({ items: null, error: `The checklist didn't load. ${spendError(e)}` }),
    );
    return () => {
      alive = false;
    };
  }, [checkpoint]);
  return state;
}


function Loading({ what }: { what: string }) {
  return (
    <div aria-busy="true" className="space-y-5">
      <p className="sr-only">Loading the {what}…</p>
      <Skeleton className="h-24" />
      <div className="grid gap-6 xl:grid-cols-5">
        <Skeleton className="h-[480px] xl:col-span-3" />
        <Skeleton className="h-[480px] xl:col-span-2" />
      </div>
    </div>
  );
}

/** What the reviewer sees once the outcome is recorded. */
function Done({ outcome, kind, back }: { outcome: ReviewOutcome; kind: ReviewKind; back: string }) {
  const text: Record<ReviewOutcome, string> = {
    cleared: kind === "memo" ? "Cleared. Finance can now prepare the voucher." : kind === "voucher" ? "Cleared. The voucher has gone to its authorisers." : "Cleared and posted. The advance is retired.",
    queried: kind === "voucher" ? "Queried. The voucher is back with its preparer, with your questions." : "Queried. It is back with the requester, with your questions.",
    rejected: "Rejected. The requester and approvers have been told why.",
  };
  return (
    <Card className="p-6 text-center">
      <span className={cx("mx-auto flex h-14 w-14 items-center justify-center rounded-2xl", outcome === "rejected" ? "bg-rose-100 text-rose-700" : outcome === "queried" ? "bg-sun-100 text-sun-700" : "bg-mint-100 text-mint-700")}>
        {outcome === "queried" ? <MessageCircleQuestion size={24} aria-hidden /> : <BadgeCheck size={24} aria-hidden />}
      </span>
      <p role="status" className="mt-3 text-[15px] font-semibold text-neutral-900">
        {text[outcome]}
      </p>
      <div className="mt-4 flex justify-center">
        <ButtonLink href={back} variant="primary" icon={ArrowLeft}>
          Back to the queue
        </ButtonLink>
      </div>
    </Card>
  );
}

/** The FCU's side of a query thread: reply, or close it once satisfied. */
function FcuThreads({ queries, onChanged }: { queries: SpendQuery[]; onChanged: () => void }) {
  return (
    <QueryThreads
      queries={queries}
      canReply={(q) => q.status !== "closed"}
      replyLabel="Reply"
      onReply={async (q, body) => {
        await spend.fcu.message(q.id, { body });
        onChanged();
      }}
      onClose={async (q) => {
        await spend.fcu.message(q.id, { close: true });
        onChanged();
      }}
    />
  );
}

function Layout({ document, review }: { document: React.ReactNode; review: React.ReactNode }) {
  return (
    <div className="grid gap-6 xl:grid-cols-5">
      <div className="min-w-0 space-y-5 xl:col-span-3">{document}</div>
      <aside className="min-w-0 xl:col-span-2" aria-label="Review">
        <div className="xl:sticky xl:top-20">{review}</div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Memo vetting (checkpoint 1)                                        */
/* ------------------------------------------------------------------ */

export function FcuMemoReview({ id }: { id: string }) {
  const { user } = useAuth();
  const checklist = useChecklist(1);
  const [memo, setMemo] = useState<MemoFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [done, setDone] = useState<ReviewOutcome | null>(null);

  useEffect(() => {
    let alive = true;
    spend.memos.get(id).then(
      (m) => {
        if (!alive) return;
        setMemo(m);
        setError(null);
      },
      (e: unknown) => alive && setError(`This memo didn't load. ${spendError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);
  const back = "/suite/finance/fcu?tab=memos";

  if (error && !memo) {
    return (
      <div>
        <BackLink href={back} label="FCU queues" />
        <LoadError text={error} onRetry={refresh} />
      </div>
    );
  }
  if (!memo) return <Loading what="memo" />;

  const m = memo;
  const waiting = m.status === "awaiting_fcu" || m.status === "fcu_queried";
  const may = mayDo(user, "fcu", "review_memo");

  return (
    <div>
      <BackLink href={back} label="FCU queues" />
      <PageHeader
        eyebrow={`Memo vetting · ${m.reference ?? ""} · ${memoType(m.type)}`}
        title={m.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <MemoStatusChip status={m.status} />
            <span className="text-neutral-500">Asked for by {m.requester ?? "-"}</span>
          </span>
        }
        actions={
          m.approvalId ? (
            <ButtonLink href={`/suite/approvals/${m.approvalId}`} icon={Stamp}>
              Approval trail
            </ButtonLink>
          ) : undefined
        }
      />
      <MemoSummaryCard memo={m} />
      <Layout
        document={
          <>
            <Panel title="The request" icon={Info}>
              <MemoFacts memo={m} />
              {m.body && (
                <div className="mt-4 border-t border-neutral-100 pt-4">
                  <p className="text-xs font-medium text-neutral-500">Justification</p>
                  <RichTextView value={m.body} size="sm" className="mt-1 text-neutral-800" />
                </div>
              )}
            </Panel>
            <Panel title="Funds when it was sent" icon={PiggyBank} hue="grape">
              {m.fundsSnapshot ? <FundsSnapshotView snapshot={m.fundsSnapshot} currency={m.currency ?? "NGN"} /> : <p className="text-sm text-neutral-500">{m.projectId ? "No funds check was recorded." : "Charged to a cost centre: no project funds to check."}</p>}
            </Panel>
            <Panel title="Documents" subtitle="Download each one to check it" icon={FileStack} hue="sky">
              <ChecklistDocuments items={m.checklist} documents={m.documents} />
            </Panel>
            {m.queries.length > 0 && (
              <Panel title="Queries" icon={MessageCircleQuestion} hue="sun">
                <FcuThreads queries={m.queries} onChanged={refresh} />
              </Panel>
            )}
            <Panel title="Earlier reviews" icon={ClipboardCheck} hue="mint">
              <ReviewList reviews={m.reviews} />
            </Panel>
            <Panel title="History" icon={History} hue="slate">
              <HistoryTimeline history={m.history} label={(s) => memoStatus(s).label} />
            </Panel>
          </>
        }
        review={
          done ? (
            <Done outcome={done} kind="memo" back={back} />
          ) : checklist.error ? (
            <ErrorNote>{checklist.error}</ErrorNote>
          ) : !checklist.items ? (
            <Skeleton className="h-[480px]" />
          ) : (
            <ReviewPanel
              kind="memo"
              items={checklist.items}
              disabled={!waiting || !may}
              disabledReason={!may ? "Your role can see this memo but not vet it." : !waiting ? `This memo isn't waiting for the FCU: it is ${memoStatus(m.status).label.toLowerCase()}.` : undefined}
              onSubmit={async (outcome, items, comment) => {
                const next = await spend.fcu.reviewMemo(m.id, { items, outcome, comment });
                setMemo(next);
                setDone(outcome);
              }}
            />
          )
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Voucher pre-audit (checkpoint 2)                                   */
/* ------------------------------------------------------------------ */

/** The voucher's facts, shared by the pre-audit and the payment confirmation. */
export function VoucherFacts({ pv }: { pv: VoucherFull }) {
  const bank = pv.payeeBank;
  return (
    <InfoList cols={2}>
      <InfoRow icon={UserRound} label="Payee" hue="mint">
        {pv.payee}
        <span className="block text-xs font-normal text-neutral-500">{pv.payeeKind === "staff" ? "Member of staff" : "Vendor"}</span>
      </InfoRow>
      <InfoRow icon={Landmark} label="Paid into" hue="sky">
        {bank ? (
          <>
            {bank.bankName ?? "Bank"} {bank.last4 ? `•••• ${bank.last4}` : ""}
            <span className="block text-xs font-normal text-neutral-500">
              {bank.accountName ?? ""}
              {bank.source ? ` · from the ${(PAYEE_SOURCE[bank.source] ?? bank.source).toLowerCase()}` : ""}
            </span>
          </>
        ) : (
          <span className="text-neutral-500">No approved bank details</span>
        )}
      </InfoRow>
      <InfoRow icon={Building2} label="Paid from" hue="blue">
        {pv.payingBankAccount ?? <span className="text-neutral-500">Not chosen yet</span>}
      </InfoRow>
      <InfoRow icon={UserRound} label="Prepared by" hue="grape">
        {pv.preparedBy ?? "-"} <span className="block text-xs font-normal text-neutral-500">{day(pv.date)}</span>
      </InfoRow>
      {pv.narration && (
        <InfoRow icon={Info} label="Narration" hue="slate">
          {pv.narration}
        </InfoRow>
      )}
      <InfoRow icon={Stamp} label="Authorisation" hue="grape">
        {pv.approvalId ? (
          <Link href={`/suite/approvals/${pv.approvalId}`} className="font-semibold text-primary-700 hover:underline">
            Open the approval
          </Link>
        ) : (
          "Not sent for authorisation yet"
        )}
      </InfoRow>
    </InfoList>
  );
}

export function VoucherFigures({ pv }: { pv: VoucherFull }) {
  return (
    <Card className="mb-5 p-5">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Figure label="Gross">
          <Money value={pv.gross} currency={pv.currency} />
        </Figure>
        <Figure label="VAT">
          <Money value={pv.vat} currency={pv.currency} />
        </Figure>
        <Figure label="WHT deducted" tone="out">
          <Money value={pv.wht} currency={pv.currency} />
        </Figure>
        <Figure label="Net payable">
          <Money value={pv.net} currency={pv.currency} />
        </Figure>
      </dl>
    </Card>
  );
}

export function VoucherLinesTable({ pv }: { pv: VoucherFull }) {
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">Voucher lines</caption>
        <thead>
          <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
            <th scope="col" className="px-5 py-2.5">
              Account
            </th>
            <th scope="col" className="px-3 py-2.5">
              Description
            </th>
            <th scope="col" className="px-3 py-2.5 text-right">
              Gross
            </th>
            <th scope="col" className="px-3 py-2.5 text-right">
              WHT
            </th>
            <th scope="col" className="px-5 py-2.5 text-right">
              Net
            </th>
          </tr>
        </thead>
        <tbody>
          {pv.lines.map((l) => (
            <tr key={l.lineNo} className="border-b border-neutral-100 last:border-0">
              <td className="whitespace-nowrap px-5 py-2.5 text-neutral-800">{l.account ? `${l.account.code} · ${l.account.name}` : "-"}</td>
              <td className="px-3 py-2.5 text-neutral-700">
                {l.description ?? "-"}
                {l.whtOverrideReason && <span className="block text-xs text-sun-700">WHT changed: {l.whtOverrideReason}</span>}
              </td>
              <td className="px-3 py-2.5 text-right">
                <Money value={l.gross} currency={pv.currency} />
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-right text-neutral-600">
                <Money value={l.wht} currency={pv.currency} />
                {l.whtRateBp != null && <span className="block text-xs text-neutral-500">{(l.whtRateBp / 100).toFixed(1)}%</span>}
              </td>
              <td className="px-5 py-2.5 text-right font-semibold">
                <Money value={l.net} currency={pv.currency} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FcuVoucherReview({ id }: { id: string }) {
  const { user } = useAuth();
  const checklist = useChecklist(2);
  const [pv, setPv] = useState<VoucherFull | null>(null);
  const [memos, setMemos] = useState<MemoFull[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [done, setDone] = useState<ReviewOutcome | null>(null);

  useEffect(() => {
    let alive = true;
    spend.vouchers.get(id).then(
      (v) => {
        if (!alive) return;
        setPv(v);
        setError(null);
        // The memos it pays, with their balance and funds snapshot.
        Promise.all(v.memos.map((m) => spend.memos.get(m.id).catch(() => null))).then((rows) => alive && setMemos(rows.filter((r): r is MemoFull => r !== null)));
      },
      (e: unknown) => alive && setError(`This voucher didn't load. ${spendError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);
  const back = "/suite/finance/fcu?tab=vouchers";

  if (error && !pv) {
    return (
      <div>
        <BackLink href={back} label="FCU queues" />
        <LoadError text={error} onRetry={refresh} />
      </div>
    );
  }
  if (!pv) return <Loading what="voucher" />;

  const waiting = pv.status === "submitted_to_fcu";
  const may = mayDo(user, "fcu", "review_voucher");
  const s = voucherStatus(pv.status);

  return (
    <div>
      <BackLink href={back} label="FCU queues" />
      <PageHeader
        eyebrow="Voucher pre-audit"
        title={`${pv.pvNo ?? "Voucher"} · ${pv.payee}`}
        subtitle={
          <Chip hue={s.hue} dot>
            {s.label}
          </Chip>
        }
      />
      <VoucherFigures pv={pv} />
      <Layout
        document={
          <>
            <Panel title="The voucher" icon={Info}>
              <VoucherFacts pv={pv} />
            </Panel>
            <Panel title="Lines" icon={ListOrdered} hue="grape">
              <VoucherLinesTable pv={pv} />
            </Panel>
            <Panel title="The memo it pays" subtitle="Payee, amount within the balance, project" icon={ReceiptText} hue="coral">
              {pv.memos.length === 0 ? (
                <p className="text-sm text-neutral-500">No memo linked.</p>
              ) : (
                <ul className="space-y-4">
                  {pv.memos.map((link) => {
                    const full = memos.find((x) => x.id === link.id);
                    const within = full ? link.amount <= full.balance : true;
                    return (
                      <li key={link.id} className="rounded-2xl border border-neutral-200/80 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <span className="min-w-0">
                            <Link href={`/suite/finance/memos/${link.id}`} className="font-semibold text-primary-700 hover:underline">
                              {link.reference ?? "Memo"} · {link.title}
                            </Link>
                            {full && (
                              <span className="mt-0.5 block text-xs text-neutral-500">
                                {full.requester} · {full.project ?? full.costCentre ?? "-"} · payee {full.payee?.name ?? "-"}
                              </span>
                            )}
                          </span>
                          {full && <MemoStatusChip status={full.status} />}
                        </div>
                        {full && (
                          <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                            <div>
                              <dt className="text-xs text-neutral-500">Memo approved</dt>
                              <dd className="font-semibold">
                                <Money value={full.approvedAmount ?? full.amount} />
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-neutral-500">Still to pay</dt>
                              <dd className="font-semibold">
                                <Money value={full.balance} />
                              </dd>
                            </div>
                            <div>
                              <dt className="text-xs text-neutral-500">This voucher</dt>
                              <dd className={cx("font-semibold", !within && "text-rose-700")}>
                                <Money value={link.amount} />
                              </dd>
                            </div>
                          </dl>
                        )}
                        {full && !within && <p className="mt-2 text-xs font-medium text-rose-700">The voucher pays more than the memo has left ({amount(full.balance)}).</p>}
                        {full?.fundsSnapshot && (
                          <details className="mt-3">
                            <summary className="cursor-pointer text-xs font-semibold text-primary-700">Funds when the memo was sent</summary>
                            <div className="mt-3">
                              <FundsSnapshotView snapshot={full.fundsSnapshot} />
                            </div>
                          </details>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
            <Panel title="Documents" icon={FileStack} hue="sky">
              <DocumentList documents={pv.documents} empty="No documents on the voucher. The memo's documents are on the memo." />
            </Panel>
            {pv.queries.length > 0 && (
              <Panel title="Queries" icon={MessageCircleQuestion} hue="sun">
                <FcuThreads queries={pv.queries} onChanged={refresh} />
              </Panel>
            )}
            <Panel title="Earlier reviews" icon={ClipboardCheck} hue="mint">
              <ReviewList reviews={pv.reviews} />
            </Panel>
            <Panel title="History" icon={History} hue="slate">
              <HistoryTimeline history={pv.history} label={(st) => voucherStatus(st).label} />
            </Panel>
          </>
        }
        review={
          done ? (
            <Done outcome={done} kind="voucher" back={back} />
          ) : checklist.error ? (
            <ErrorNote>{checklist.error}</ErrorNote>
          ) : !checklist.items ? (
            <Skeleton className="h-[420px]" />
          ) : (
            <ReviewPanel
              kind="voucher"
              items={checklist.items}
              disabled={!waiting || !may}
              disabledReason={!may ? "Your role can see this voucher but not pre-audit it." : !waiting ? `This voucher isn't waiting for the FCU: it is ${s.label.toLowerCase()}.` : undefined}
              onSubmit={async (outcome, items, comment) => {
                if (outcome === "rejected") return;
                setPv(await spend.fcu.reviewVoucher(pv.id, { items, outcome, comment }));
                setDone(outcome);
              }}
            />
          )
        }
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Retirement vetting (checkpoint 4)                                  */
/* ------------------------------------------------------------------ */

export function FcuRetirementReview({ id }: { id: string }) {
  const { user } = useAuth();
  const checklist = useChecklist(4);
  const [memo, setMemo] = useState<MemoFull | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [done, setDone] = useState<ReviewOutcome | null>(null);
  const projects = useLookup("projects");
  const [costCentres, setCostCentres] = useState<Record<string, string>>({});
  const [banks, setBanks] = useState<Record<string, string>>({});

  /* By the retirement's own id, so a link still opens once it has left the queue. */
  useEffect(() => {
    let alive = true;
    spend.fcu.retirement(id).then(
      (m) => {
        if (!alive) return;
        setMemo(m);
        setError(null);
      },
      (e: unknown) => alive && setError(`This retirement didn't load. ${spendError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [id, reload]);

  useEffect(() => {
    let alive = true;
    orgFoundations.lookups.costCentres().then(
      (rows) => alive && setCostCentres(Object.fromEntries(rows.map((c) => [c.id, `${c.code} · ${c.name}`]))),
      () => undefined,
    );
    banking.accounts.list().then(
      (rows) => alive && setBanks(Object.fromEntries(rows.map((b) => [b.id, `${b.name} (${b.number})`]))),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, []);

  const refresh = useCallback(() => setReload((k) => k + 1), []);
  const back = "/suite/finance/fcu?tab=retirements";

  if (error && !memo) {
    return (
      <div>
        <BackLink href={back} label="FCU queues" />
        <LoadError text={error} onRetry={refresh} />
      </div>
    );
  }
  if (!memo) return <Loading what="retirement" />;

  const r: Retirement | null = memo.retirement;
  if (!r) {
    return (
      <div>
        <BackLink href={back} label="FCU queues" />
        <ErrorNote>This advance has no retirement yet.</ErrorNote>
      </div>
    );
  }

  const projectName = (pid: string | null) => (pid ? (projects.options.find((o) => o.value === pid)?.label ?? "Project") : null);
  const sum = retirementSum(
    r.lines.map((l) => l.amount),
    r.refund,
    r.advanced,
  );
  const waiting = r.status === "submitted";
  const may = mayDo(user, "fcu", "review_retirement");
  const st = retirementStatus(r.status);

  return (
    <div>
      <BackLink href={back} label="FCU queues" />
      <PageHeader
        eyebrow={`Retirement vetting · ${memo.reference ?? ""}`}
        title={`${memo.requester ?? "Advance"}: ${memo.title}`}
        subtitle={
          <Chip hue={st.hue} dot>
            {st.label}
          </Chip>
        }
        actions={
          <ButtonLink href={`/suite/finance/memos/${memo.id}`} icon={ReceiptText}>
            Open the advance
          </ButtonLink>
        }
      />
      <Card className="mb-5 p-5">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Figure label="Advanced">
            <Money value={r.advanced} />
          </Figure>
          <Figure label="Spent" tone="out">
            <Money value={r.spent} />
          </Figure>
          <Figure label="Cash returned" tone="in">
            <Money value={r.refund} />
          </Figure>
          <Figure label="Difference">
            <span className={sum.gap === 0 ? "text-mint-700" : "text-rose-700"}>{sum.gap === 0 ? "Balances" : amount(sum.gap)}</span>
          </Figure>
        </dl>
      </Card>
      <Layout
        document={
          <>
            <Panel title="What the advance was for" icon={Info}>
              <MemoFacts memo={memo} />
              {memo.body && <RichTextView value={memo.body} size="sm" className="mt-4 border-t border-neutral-100 pt-4 text-neutral-800" />}
            </Panel>
            <Panel title="What it was spent on" icon={ListOrdered} hue="grape">
              <ul className="divide-y divide-neutral-100">
                {r.lines.map((l, i) => (
                  <li key={i} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <span className="min-w-0">
                      <span className="block font-semibold text-neutral-900">{l.description}</span>
                      <span className="block text-xs text-neutral-500">
                        {l.account ? `${l.account.code} · ${l.account.name}` : "No account"}
                        {projectName(l.projectId) ? ` · ${projectName(l.projectId)}` : ""}
                        {l.costCentreId ? ` · ${costCentres[l.costCentreId] ?? "Cost centre"}` : ""}
                      </span>
                    </span>
                    <Money value={l.amount} className="font-semibold" />
                  </li>
                ))}
              </ul>
              {r.refund > 0 && (
                <p className="mt-3 rounded-xl bg-mint-50 px-3 py-2.5 text-sm text-mint-700">
                  {amount(r.refund)} returned into {r.refundBankAccountId ? (banks[r.refundBankAccountId] ?? "a bank account") : "-"}.
                </p>
              )}
            </Panel>
            <Panel title="Receipts" icon={FileStack} hue="sky">
              <DocumentList documents={r.documents} empty="No receipts attached." />
            </Panel>
            {r.queries.length > 0 && (
              <Panel title="Queries" icon={MessageCircleQuestion} hue="sun">
                <FcuThreads queries={r.queries} onChanged={refresh} />
              </Panel>
            )}
          </>
        }
        review={
          done ? (
            <Done outcome={done} kind="retirement" back={back} />
          ) : checklist.error ? (
            <ErrorNote>{checklist.error}</ErrorNote>
          ) : !checklist.items ? (
            <Skeleton className="h-[420px]" />
          ) : (
            <ReviewPanel
              kind="retirement"
              items={checklist.items}
              disabled={!waiting || !may}
              disabledReason={!may ? "Your role can see this retirement but not vet it." : !waiting ? `This retirement isn't waiting for the FCU: it is ${st.label.toLowerCase()}.` : undefined}
              onSubmit={async (outcome, items, comment) => {
                if (outcome === "rejected") return;
                const next = await spend.fcu.reviewRetirement(r.id, { items, outcome, comment });
                setMemo({ ...memo, retirement: next });
                setDone(outcome);
              }}
            />
          )
        }
      />
    </div>
  );
}
