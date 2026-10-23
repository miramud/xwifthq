"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileStack, FileWarning, History, Info, MessageCircleQuestion, PencilLine, PiggyBank, ReceiptText, Stamp, Trash2, Undo2 } from "lucide-react";
import { Button, ButtonLink, Chip, PageHeader, Panel } from "@/components/workspace/kit";
import { day } from "@/suite/finance/lib/format";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton, textareaClass } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { ApiError, spend, spendError, type MemoFull, type SpendDocument } from "@/lib/api/finance-spend-client";
import { mayUseFinance } from "@/suite/finance/lib/finance-access";
import { ChecklistDocuments, FundsSnapshotView, HistoryTimeline, MemoStatusChip, QueryThreads } from "./ui";
import { MemoFacts, MemoSummaryCard, NextStepBanner, VoucherLinks } from "./MemoParts";
import RetirementForm from "./RetirementForm";
import { memoStatus, memoType, takesDocuments } from "./labels";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * One of my requests: where it is, what the FCU asked and the answers, the
 * documents, the voucher(s) paying it, and - for a paid advance - the
 * retirement. Withdraw it while it is in approval; delete a draft.
 */
export default function RequestDetail({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [memo, setMemo] = useState<MemoFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [actionError, setActionError] = useState<string | null>(null);
  const [withdrawing, setWithdrawing] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [docErrors, setDocErrors] = useState<Record<string, string>>({});
  const [categories, setCategories] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    spend.me
      .get(id)
      .then((m) => {
        if (!alive) return;
        setMemo(m);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        setLoadError(
          e instanceof ApiError && e.status === 404 ? "This request wasn't found among yours. It may have been deleted, or raised by somebody else." : `This request didn't load. ${spendError(e)}`,
        );
      });
    return () => {
      alive = false;
    };
  }, [id, reload]);

  useEffect(() => {
    spend.me.options().then(
      (o) => setCategories(o.categories),
      () => undefined,
    );
  }, []);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (loadError && !memo) {
    return (
      <div>
        <BackLink href="/suite/finance/requests" label="My requests" />
        <LoadError text={loadError} onRetry={refresh} />
        {mayUseFinance(user, "memos") && (
          <p className="text-sm text-neutral-600">
            Looking for somebody else&apos;s request? Open it from the{" "}
            <Link href={`/suite/finance/memos/${id}`} className="font-semibold text-primary-700 underline">
              memo register
            </Link>
            .
          </p>
        )}
      </div>
    );
  }

  if (!memo) {
    return (
      <div aria-busy="true" className="space-y-5">
        <p className="sr-only">Loading the request…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[160px]" />
        <Skeleton className="h-[360px]" />
      </div>
    );
  }

  const m = memo;
  const currency = m.currency ?? "NGN";
  const openQueries = m.queries.filter((q) => q.status === "open");
  const retirementQueries = m.retirement?.queries ?? [];
  const showRetirement = m.type === "advance" && (m.status === "awaiting_retirement" || m.status === "retired" || m.retirement !== null);

  const onDelete = async () => {
    const ok = await confirm({ title: "Delete this draft?", recoverable: true, confirmLabel: "Delete draft" });
    if (!ok) return;
    setBusy(true);
    try {
      await spend.me.remove(m.id);
      router.push("/suite/finance/requests");
    } catch (e) {
      setActionError(spendError(e));
      setBusy(false);
    }
  };

  const onWithdraw = async () => {
    const ok = await confirm({
      title: "Withdraw this request?",
      body: "Approval stops and nobody can act on it any more. To ask again, raise a new request.",
      confirmLabel: "Withdraw request",
    });
    if (!ok) return;
    setBusy(true);
    setActionError(null);
    try {
      setMemo(await spend.me.withdraw(m.id, reason.trim()));
      setWithdrawing(false);
    } catch (e) {
      setActionError(spendError(e));
    } finally {
      setBusy(false);
    }
  };

  const onUpload = async (code: string, file: File) => {
    setUploading(code);
    setDocErrors({});
    try {
      const docs = await spend.me.upload(m.id, file, code);
      setMemo({ ...m, documents: docs, checklist: m.checklist.map((c) => ({ ...c, attached: docs.filter((d) => d.itemCode === c.code).length })) });
    } catch (e) {
      setDocErrors({ [code]: spendError(e) });
    } finally {
      setUploading(null);
    }
  };

  const onRemove = async (d: SpendDocument) => {
    const ok = await confirm({ title: `Remove ${d.fileName}?`, body: "The file is taken off this request and deleted.", confirmLabel: "Remove" });
    if (!ok) return;
    try {
      await spend.me.deleteDocument(d.id);
      refresh();
    } catch (e) {
      setDocErrors({ [d.itemCode ?? "_"]: spendError(e) });
    }
  };

  const answer = async (queryId: string, body: string) => {
    await spend.me.answer(queryId, body);
    refresh();
  };

  return (
    <div>
      <BackLink href="/suite/finance/requests" label="My requests" />
      <PageHeader
        eyebrow={`${m.reference ?? "Draft"} · ${memoType(m.type)}`}
        title={m.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <MemoStatusChip status={m.status} />
            {m.overridden && <Chip hue="sun">Beyond funds, MD approved</Chip>}
            {m.postFacto && (
              <Chip hue="rose" icon={FileWarning}>
                Post-facto: already paid
              </Chip>
            )}
            {m.expirable && m.expiresOn && <Chip hue={m.pastExpiry ? "rose" : "slate"}>{m.pastExpiry ? "May be expired by Finance" : `Expires ${day(m.expiresOn)} if unpaid`}</Chip>}
          </span>
        }
        actions={
          <>
            {m.status === "draft" && (
              <>
                <Button variant="ghost" icon={Trash2} onClick={() => void onDelete()} disabled={busy}>
                  Delete draft
                </Button>
                <ButtonLink href={`/suite/finance/requests/new?id=${m.id}`} variant="primary" icon={PencilLine}>
                  Finish and send
                </ButtonLink>
              </>
            )}
            {m.status === "in_approval" && !withdrawing && (
              <Button icon={Undo2} onClick={() => setWithdrawing(true)} disabled={busy}>
                Withdraw it
              </Button>
            )}
            {m.approvalId && (
              <ButtonLink href={`/suite/approvals/${m.approvalId}`} icon={Stamp}>
                Open the approval
              </ButtonLink>
            )}
          </>
        }
      />

      {withdrawing && (
        <Panel title="Withdraw this request" subtitle="Tell the approvers why (optional)" className="mb-5">
          <label htmlFor="withdraw-reason" className="sr-only">
            Reason for withdrawing
          </label>
          <textarea id="withdraw-reason" rows={2} className={textareaClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="No longer needed: the supplier dropped the price" />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setWithdrawing(false)} disabled={busy}>
              Keep it in approval
            </Button>
            <Button variant="danger" icon={Undo2} onClick={() => void onWithdraw()} disabled={busy}>
              Withdraw request
            </Button>
          </div>
        </Panel>
      )}

      {actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}

      <MemoSummaryCard memo={m} />
      <NextStepBanner memo={m} />

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          {(m.queries.length > 0 || m.status === "fcu_queried") && (
            <Panel
              title="The FCU's questions"
              subtitle={openQueries.length > 0 ? "Answering sends the request back to the FCU" : "Answered; kept on the request for the record"}
              icon={MessageCircleQuestion}
              hue="sun"
            >
              <QueryThreads
                queries={m.queries}
                canReply={(q) => q.status === "open"}
                replyLabel="Answer the FCU"
                replyHint="If they asked for a document, attach it under Documents below first."
                onReply={(q, body) => answer(q.id, body)}
              />
            </Panel>
          )}

          {showRetirement && (
            <Panel title="Retire your advance" subtitle="Account for every naira: what it was spent on, and any cash returned" icon={ReceiptText} hue="coral">
              {retirementQueries.length > 0 && (
                <div className="mb-5">
                  <QueryThreads queries={retirementQueries} canReply={(q) => q.status === "open"} replyLabel="Answer the FCU" onReply={(q, body) => answer(q.id, body)} />
                </div>
              )}
              <RetirementForm memo={m} onChanged={(r) => setMemo({ ...m, retirement: r })} />
            </Panel>
          )}

          <Panel title="About this request" icon={Info}>
            <MemoFacts memo={m} categories={categories} />
            {m.body && (
              <div className="mt-4 border-t border-neutral-100 pt-4">
                <p className="text-xs font-medium text-neutral-500">Justification</p>
                <RichTextView value={m.body} size="sm" className="mt-1 text-neutral-800" />
              </div>
            )}
          </Panel>

          <Panel
            title="Documents"
            subtitle={takesDocuments(m.status) ? "You can add documents while the FCU's query is open" : "Locked once sent; the FCU vetted these files"}
            icon={FileStack}
            hue="sky"
          >
            <ChecklistDocuments
              items={m.checklist}
              documents={m.documents}
              onUpload={takesDocuments(m.status) ? (c, f) => void onUpload(c, f) : undefined}
              onRemove={takesDocuments(m.status) ? (d) => void onRemove(d) : undefined}
              busyCode={uploading}
              errors={docErrors}
            />
          </Panel>

          <Panel title="Payment" icon={PiggyBank} hue="mint">
            <VoucherLinks vouchers={m.vouchers} linkable={mayUseFinance(user, "vouchers")} currency={currency} />
          </Panel>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Funds and history">
          <Panel title="Funds when it was sent" icon={PiggyBank} hue="grape">
            {m.fundsSnapshot ? (
              <FundsSnapshotView snapshot={m.fundsSnapshot} currency={currency} />
            ) : (
              <p className="text-sm text-neutral-500">{m.projectId ? "The project's funds are checked and recorded when you send it." : "Charged to a cost centre: there are no project funds to check."}</p>
            )}
          </Panel>
          <Panel title="History" icon={History} hue="slate">
            <HistoryTimeline history={m.history} label={(s) => memoStatus(s).label} />
          </Panel>
        </aside>
      </div>
    </div>
  );
}
