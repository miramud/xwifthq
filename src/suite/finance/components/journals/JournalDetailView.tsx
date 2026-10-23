"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileInput,
  Hash,
  Pencil,
  RotateCcw,
  Send,
  Stamp,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { errorText, ledger, type JournalDetail } from "@/lib/api/finance-ledger-client";
import { Button, ButtonLink, Card, Chip, PageHeader, Panel, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, InfoList, InfoRow, Skeleton, inputClass, textareaClass } from "@/suite/lms/components/ui/ws";
import { DialogFrame } from "@/suite/org/components/ui";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, day } from "@/suite/finance/lib/format";
import { JournalStatusChip } from "./JournalsBoard";
import { journalSource, journalTypeLabel, plainError } from "./meta";
import { dayKey } from "../periods/PeriodStrip";

/**
 * One journal: what it records, its lines with their dimensions, where it
 * came from, who keyed and posted it, and what can still be done to it.
 */

const NOTICES: Record<string, string> = {
  saved: "Draft saved.",
  submitted: "Sent for approval. It posts when it is approved.",
};

export default function JournalDetailView({ id }: { id: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [j, setJ] = useState<JournalDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(() => {
    const n = params?.get("notice");
    return n ? (NOTICES[n] ?? n) : null;
  });
  const [reversing, setReversing] = useState(false);

  useEffect(() => {
    let alive = true;
    ledger.journals
      .get(id)
      .then((r) => {
        if (!alive) return;
        setJ(r);
        setLoadError(null);
      })
      .catch((e: unknown) => alive && setLoadError(errorText(e) || "The journal didn't load."));
    return () => {
      alive = false;
    };
  }, [id, reload]);

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/finance/journals" label="All journals" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!j) return <Skeleton className="h-[30rem]" />;

  const act = async (fn: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setActionError(null);
    try {
      await fn();
      setNotice(done);
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(plainError(errorText(e)));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!(await confirm({ title: "Delete this draft?", body: "The draft and its lines are removed. Nothing was posted, so the books don't change.", confirmLabel: "Delete draft" }))) return;
    setBusy(true);
    try {
      await ledger.journals.remove(j.id);
      router.push("/suite/finance/journals");
    } catch (e) {
      setActionError(plainError(errorText(e)));
      setBusy(false);
    }
  };

  const post = async () => {
    if (
      !(await confirm({
        title: "Post this journal?",
        body: "It goes into the books and can't be changed afterwards; only a reversal can undo it.",
        confirmLabel: "Post journal",
        tone: "primary",
      }))
    )
      return;
    await act(() => ledger.journals.post(j.id), "Posted.");
  };

  const src = journalSource(j.sourceType, j.sourceId);
  const foreign = j.lines.some((l) => l.txnCurrency && l.txnCurrency !== j.currency);
  const debits = j.lines.reduce((s, l) => s + l.debit, 0);
  const credits = j.lines.reduce((s, l) => s + l.credit, 0);
  const isDraft = j.status === "draft";
  const canSubmit = (j.status === "draft" || j.status === "rejected") && mayDo(user, "journals", "submit");
  const canPost = j.status === "pending_approval" && !j.approvalId && mayDo(user, "journals", "post");
  const canReverse = j.status === "posted" && !j.reversesJournalId && mayDo(user, "journals", "reverse");

  return (
    <div>
      <BackLink href="/suite/finance/journals" label="All journals" />
      <PageHeader
        eyebrow={journalTypeLabel(j.type)}
        title={
          <span className="flex flex-wrap items-center gap-3">
            {j.journalNo ?? "Draft journal"}
            <JournalStatusChip status={j.status} />
          </span>
        }
        subtitle={j.narration}
        actions={
          <>
            {isDraft && mayDo(user, "journals", "delete") && (
              <Button variant="ghost" icon={Trash2} onClick={remove} disabled={busy}>
                Delete draft
              </Button>
            )}
            {isDraft && mayDo(user, "journals", "update") && (
              <ButtonLink href={`/suite/finance/journals/${j.id}/edit`} icon={Pencil}>
                Edit
              </ButtonLink>
            )}
            {canReverse && (
              <Button icon={RotateCcw} onClick={() => setReversing(true)} disabled={busy}>
                Reverse
              </Button>
            )}
            {j.status === "pending_approval" && j.approvalId && (
              <ButtonLink href={`/suite/approvals/${j.approvalId}`} variant="primary" icon={ExternalLink}>
                Open the approval
              </ButtonLink>
            )}
            {canPost && (
              <Button variant="primary" icon={Stamp} onClick={post} disabled={busy}>
                Post journal
              </Button>
            )}
            {canSubmit && (
              <Button variant="primary" icon={Send} onClick={() => act(() => ledger.journals.submit(j.id), "Sent for approval. It posts when it is approved.")} disabled={busy}>
                {j.status === "rejected" ? "Send for approval again" : "Send for approval"}
              </Button>
            )}
          </>
        }
      />

      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-5">{actionError}</ErrorNote>}
      {j.status === "rejected" && (
        <ErrorNote className="mb-5">
          This journal was rejected.{" "}
          {j.approvalId && (
            <Link href={`/suite/approvals/${j.approvalId}`} className="font-semibold underline">
              See why
            </Link>
          )}
        </ErrorNote>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <caption className="sr-only">Lines of {j.journalNo ?? "this journal"}</caption>
                <thead>
                  <tr className="border-b border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="w-10 py-3 pl-5 pr-2 text-right">
                      #
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Account
                    </th>
                    <th scope="col" className="px-3 py-3">
                      Detail
                    </th>
                    <th scope="col" className="px-3 py-3 text-right">
                      Debit
                    </th>
                    <th scope="col" className="py-3 pl-3 pr-5 text-right">
                      Credit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {j.lines.map((l) => {
                    const fx = l.txnCurrency && l.txnCurrency !== j.currency;
                    return (
                      <tr key={l.id} className="border-b border-neutral-100 align-top last:border-0">
                        <td className="py-3 pl-5 pr-2 text-right text-xs tabular-nums text-neutral-400">{l.lineNo}</td>
                        <td className="px-3 py-3">
                          <Link href={`/suite/finance/reports/ledger/${l.account.id}`} className="rounded font-medium text-neutral-900 outline-none hover:text-primary-700 hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                            <span className="font-mono text-[13px] text-neutral-500">{l.account.code}</span> {l.account.name}
                          </Link>
                          {l.narration && <p className="mt-0.5 text-xs text-neutral-500">{l.narration}</p>}
                        </td>
                        <td className="px-3 py-3">
                          <span className="flex flex-wrap gap-1">
                            {l.costCentre && <Chip hue="sky" className="!px-2 !py-0.5 !text-[11px]">{l.costCentre.code} {l.costCentre.name}</Chip>}
                            {l.project && <Chip hue="grape" className="!px-2 !py-0.5 !text-[11px]">{l.project.name ?? "Project"}</Chip>}
                            {l.counterparty && <Chip hue="coral" className="!px-2 !py-0.5 !text-[11px]">{l.counterparty.name}</Chip>}
                            {l.person && <Chip hue="mint" className="!px-2 !py-0.5 !text-[11px]">{l.person.name}</Chip>}
                            {!l.costCentre && !l.project && !l.counterparty && !l.person && <span className="text-neutral-400">—</span>}
                          </span>
                        </td>
                        {(["debit", "credit"] as const).map((side) => (
                          <td key={side} className={cx("py-3 text-right tabular-nums", side === "debit" ? "px-3" : "pl-3 pr-5")}>
                            <span className="font-medium text-neutral-900">{accounting(l[side], true)}</span>
                            {fx && l[side] > 0 && (
                              <span className="mt-0.5 block text-[11px] text-neutral-500">
                                {l.txnCurrency} {accounting(side === "debit" ? l.txnDebit : l.txnCredit)}
                                {l.fxRate ? ` at ${l.fxRate}` : ""}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-neutral-200 bg-neutral-50/60 font-semibold text-neutral-900">
                    <th scope="row" colSpan={3} className="py-3 pl-5 pr-3 text-left">
                      Totals <span className="font-normal text-neutral-500">({j.currency})</span>
                    </th>
                    <td className="px-3 py-3 text-right tabular-nums">{accounting(debits)}</td>
                    <td className="py-3 pl-3 pr-5 text-right tabular-nums">{accounting(credits)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          {foreign && <p className="text-xs text-neutral-500">Foreign-currency lines show their own amount and the rate under the {j.currency} figure.</p>}
        </div>

        <div className="space-y-6">
          <Panel title="About this journal" icon={FileInput} hue="sky">
            <InfoList>
              <InfoRow icon={CalendarDays} label="Date">
                {day(j.journalDate)}
              </InfoRow>
              <InfoRow icon={Hash} label="Amount">
                {amount(j.total, j.currency)}
              </InfoRow>
              <InfoRow icon={FileInput} label="Source">
                {src ? (
                  src.href ? (
                    <Link href={src.href} className="text-primary-700 hover:underline">
                      {src.label}
                    </Link>
                  ) : (
                    src.label
                  )
                ) : (
                  "Keyed by hand"
                )}
              </InfoRow>
              <InfoRow icon={UserRound} label="Keyed by">
                {j.createdBy ?? "The software"}
              </InfoRow>
              {j.postedAt && (
                <InfoRow icon={CheckCircle2} label="Posted" hue="mint">
                  {day(j.postedAt)}
                  {j.postedBy ? ` by ${j.postedBy}` : ""}
                </InfoRow>
              )}
              {j.autoReverseOn && (
                <InfoRow icon={RotateCcw} label="Reverses itself on" hue="grape">
                  {day(j.autoReverseOn)}
                </InfoRow>
              )}
            </InfoList>
          </Panel>

          {(j.approvalId || j.reversesJournalId || j.reversedByJournalId) && (
            <Panel title="Linked" icon={ExternalLink} hue="grape">
              <ul className="space-y-2 text-sm">
                {j.approvalId && (
                  <li>
                    <Link href={`/suite/approvals/${j.approvalId}`} className="font-semibold text-primary-700 hover:underline">
                      The approval request
                    </Link>
                  </li>
                )}
                {j.reversesJournalId && (
                  <li>
                    This journal reverses{" "}
                    <Link href={`/suite/finance/journals/${j.reversesJournalId}`} className="font-semibold text-primary-700 hover:underline">
                      the original journal
                    </Link>
                  </li>
                )}
                {j.reversedByJournalId && (
                  <li>
                    Reversed by{" "}
                    <Link href={`/suite/finance/journals/${j.reversedByJournalId}`} className="font-semibold text-primary-700 hover:underline">
                      its reversal
                    </Link>
                  </li>
                )}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      {reversing && (
        <ReverseDialog
          journal={j}
          onClose={() => setReversing(false)}
          onDone={(rev) => {
            setReversing(false);
            router.push(`/suite/finance/journals/${rev}?notice=${encodeURIComponent("Reversal posted.")}`);
          }}
        />
      )}
    </div>
  );
}

function ReverseDialog({ journal, onClose, onDone }: { journal: JournalDetail; onClose: () => void; onDone: (id: string) => void }) {
  const uid = useId();
  const [date, setDate] = useState(() => dayKey(new Date()));
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Say why this journal is being reversed.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rev = await ledger.journals.reverse(journal.id, date, reason.trim());
      onDone(rev.id);
    } catch (err) {
      setError(plainError(errorText(err)));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      titleId={`${uid}-t`}
      title={`Reverse ${journal.journalNo ?? "this journal"}`}
      subtitle="Posts a mirror journal - every debit becomes a credit - so the original is cancelled in the books. Both stay on record."
      onClose={onClose}
      as="form"
      onSubmit={submit}
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={RotateCcw} disabled={busy}>
            {busy ? "Reversing…" : "Post reversal"}
          </Button>
        </div>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      <div>
        <label htmlFor={`${uid}-d`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Reversal date
        </label>
        <input id={`${uid}-d`} type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
        <p className="mt-1.5 text-xs text-neutral-500">It must fall in an open month.</p>
      </div>
      <div>
        <label htmlFor={`${uid}-r`} className="mb-1.5 block text-sm font-medium text-neutral-700">
          Reason
        </label>
        <textarea id={`${uid}-r`} aria-required="true" rows={3} maxLength={255} value={reason} onChange={(e) => setReason(e.target.value)} className={textareaClass} placeholder="e.g. Posted to the wrong cost centre" />
      </div>
    </DialogFrame>
  );
}
