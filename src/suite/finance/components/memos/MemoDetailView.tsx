"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, ClipboardCheck, FilePlus2, FileStack, FileWarning, Gavel, History, Hourglass, Info, MessageCircleQuestion, PiggyBank, ReceiptText, ShieldCheck, Stamp } from "lucide-react";
import { Button, ButtonLink, Chip, PageHeader, Panel } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton, textareaClass } from "@/suite/lms/components/ui/ws";
import { LoadError } from "@/suite/org/components/foundations/shared";
import { useAuth } from "@/lib/auth-store";
import { ApiError, spend, spendError, type FundsPosition, type MemoFull } from "@/lib/api/finance-spend-client";
import { mayDo, mayUseFinance } from "@/suite/finance/lib/finance-access";
import { amount, day } from "@/suite/finance/lib/format";
import { Money } from "@/suite/finance/components/banking/ui";
import { ChecklistDocuments, FundsSnapshotView, HistoryTimeline, MemoStatusChip, QueryThreads, ReviewList } from "@/suite/finance/components/requests/ui";
import { MemoFacts, MemoSummaryCard, VoucherLinks } from "@/suite/finance/components/requests/MemoParts";
import { memoStatus, memoType, retirementStatus } from "@/suite/finance/components/requests/labels";
import ReasonDialog from "@/suite/finance/components/vouchers/ReasonDialog";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * A request as Finance sees it: the whole picture - checklist, documents,
 * every FCU review with each item's mark, the queries, the vouchers and the
 * history - with Finance's actions: the MD's override, cancelling an
 * approved memo nobody has paid, and preparing the voucher once the FCU has
 * cleared it. The approval engine links here; a requester without Finance
 * access is sent to their own view of it.
 */
export default function MemoDetailView({ id }: { id: string }) {
  const router = useRouter();
  const { user, loading } = useAuth();
  const confirm = useConfirm();
  const finance = mayUseFinance(user, "memos");
  const [memo, setMemo] = useState<MemoFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [funds, setFunds] = useState<FundsPosition | null>(null);
  const [mode, setMode] = useState<"override" | "cancel" | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [expiring, setExpiring] = useState(false);

  /* Not Finance: this is the requester following a link to their own request. */
  useEffect(() => {
    if (!loading && user && !finance) router.replace(`/suite/finance/requests/${id}`);
  }, [loading, user, finance, id, router]);

  useEffect(() => {
    if (!finance) return;
    let alive = true;
    spend.memos
      .get(id)
      .then((m) => {
        if (!alive) return;
        setMemo(m);
        setLoadError(null);
      })
      .catch((e: unknown) => {
        if (!alive) return;
        if (e instanceof ApiError && e.status === 403) {
          router.replace(`/suite/finance/requests/${id}`);
          return;
        }
        setLoadError(`This request didn't load. ${spendError(e)}`);
      });
    return () => {
      alive = false;
    };
  }, [finance, id, reload, router]);

  /* A draft on a project: is it beyond the funds (the MD may let it through)? */
  const draftProject = memo?.status === "draft" ? memo.projectId : null;
  useEffect(() => {
    if (!draftProject) return;
    let alive = true;
    spend.me.funds(draftProject).then(
      (f) => alive && setFunds(f),
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [draftProject]);

  const refresh = useCallback(() => setReload((k) => k + 1), []);

  if (!finance) {
    return (
      <p role="status" className="text-sm text-neutral-500">
        Opening your request…
      </p>
    );
  }

  if (loadError && !memo) {
    return (
      <div>
        <BackLink href="/suite/finance/memos" label="Memo register" />
        <LoadError text={loadError} onRetry={refresh} />
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
  const overFunds = funds !== null && funds.controlled && (!funds.hasRelease || m.amount > funds.available);
  const may = {
    override: mayDo(user, "memos", "override") && m.status === "draft" && (overFunds || Boolean(m.overrideReason)),
    cancel: mayDo(user, "memos", "cancel") && m.paidAmount === 0 && ["awaiting_fcu", "fcu_queried", "fcu_cleared"].includes(m.status),
    voucher: mayDo(user, "vouchers", "create") && (m.status === "fcu_cleared" || m.status === "partially_paid"),
    vet: mayUseFinance(user, "fcu") && (m.status === "awaiting_fcu" || m.status === "fcu_queried"),
    // Approved, nothing paid, no voucher: from its expiry date; earlier only for whoever sets the limits.
    expire: mayDo(user, "memos", "expire") && Boolean(m.expirable) && (Boolean(m.pastExpiry) || mayDo(user, "spend_settings", "update_settings")),
  };

  const act = async () => {
    if (!reason.trim()) {
      setActionError(mode === "override" ? "Give the reason for going beyond the funds; it is logged." : "Say why it is cancelled; the requester is told.");
      return;
    }
    if (mode === "cancel") {
      const ok = await confirm({ title: "Cancel this request?", body: "Its commitment on the project is released and it can't be paid. This can't be undone.", confirmLabel: "Cancel request" });
      if (!ok) return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const next = mode === "override" ? await spend.memos.override(m.id, reason.trim()) : await spend.memos.cancel(m.id, reason.trim());
      setMemo(next);
      setNotice(mode === "override" ? "Override recorded. The requester can now send it beyond the funds." : "Cancelled. The project's commitment is released.");
      setMode(null);
      setReason("");
    } catch (e) {
      setActionError(spendError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <BackLink href="/suite/finance/memos" label="Memo register" />
      <PageHeader
        eyebrow={`${m.reference ?? "Draft"} · ${memoType(m.type)} · ${m.requester ?? ""}`}
        title={m.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <MemoStatusChip status={m.status} />
            {m.overridden && <Chip hue="sun">Sent beyond funds</Chip>}
            {m.postFacto && (
              <Chip hue="rose" icon={FileWarning}>
                Post-facto
              </Chip>
            )}
            {m.expirable && m.expiresOn && (
              <Chip hue={m.pastExpiry ? "rose" : "slate"} icon={Hourglass}>
                {m.pastExpiry ? `Past expiry (${day(m.expiresOn)})` : `Expires ${day(m.expiresOn)}`}
              </Chip>
            )}
          </span>
        }
        actions={
          <>
            {may.expire && mode === null && (
              <Button variant="ghost" icon={Hourglass} onClick={() => setExpiring(true)}>
                {m.pastExpiry ? "Expire it" : "Expire early"}
              </Button>
            )}
            {may.cancel && mode === null && (
              <Button variant="ghost" icon={Ban} onClick={() => setMode("cancel")}>
                Cancel it
              </Button>
            )}
            {may.override && mode === null && (
              <Button icon={Gavel} onClick={() => setMode("override")}>
                {m.overrideReason ? "Change the override" : "Allow beyond funds"}
              </Button>
            )}
            {may.vet && (
              <ButtonLink href={`/suite/finance/fcu/memos/${m.id}`} icon={ShieldCheck} variant={may.voucher ? "secondary" : "primary"}>
                Vet it
              </ButtonLink>
            )}
            {m.approvalId && (
              <ButtonLink href={`/suite/approvals/${m.approvalId}`} icon={Stamp}>
                Open the approval
              </ButtonLink>
            )}
            {may.voucher && (
              <ButtonLink href={`/suite/finance/vouchers/new?memo=${m.id}`} variant="primary" icon={FilePlus2}>
                Create voucher
              </ButtonLink>
            )}
          </>
        }
      />

      {mode && (
        <Panel
          title={mode === "override" ? "Let it go beyond the project's funds" : "Cancel this request"}
          subtitle={
            mode === "override"
              ? funds && funds.hasRelease
                ? `The project has ${amount(funds.available)} available; this asks for ${amount(m.amount)}. Your reason is logged and shown to the approvers.`
                : "No funds are released to the project yet. Your reason is logged and shown to the approvers."
              : "Only an approved request with nothing paid can be cancelled. The requester and approvers see your reason."
          }
          className="mb-6"
        >
          <label htmlFor="memo-reason" className="mb-1.5 block text-sm font-medium text-neutral-700">
            Reason
          </label>
          <textarea id="memo-reason" rows={3} className={textareaClass} value={reason} onChange={(e) => setReason(e.target.value)} />
          {actionError && <ErrorNote className="mt-3">{actionError}</ErrorNote>}
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                setMode(null);
                setActionError(null);
              }}
              disabled={busy}
            >
              Back
            </Button>
            <Button variant={mode === "cancel" ? "danger" : "primary"} icon={mode === "cancel" ? Ban : Gavel} onClick={() => void act()} disabled={busy}>
              {busy ? "Saving…" : mode === "cancel" ? "Cancel request" : "Record the override"}
            </Button>
          </div>
        </Panel>
      )}

      {!mode && actionError && <ErrorNote className="mb-4">{actionError}</ErrorNote>}
      {notice && (
        <p role="status" className="mb-4 rounded-xl border border-mint-500/25 bg-mint-50 px-4 py-3 text-sm text-mint-700">
          {notice}
        </p>
      )}
      {m.postFacto && (
        <p className="mb-4 flex items-start gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-500/25">
          <FileWarning size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <span className="font-semibold">Post-facto.</span> This memo regularises a bank debit paid without authority. Its voucher is matched to that debit when approved; nothing is paid again.
          </span>
        </p>
      )}
      {m.status === "expired" && m.expiryReason && (
        <p className="mb-4 rounded-xl bg-neutral-100 px-4 py-3 text-sm text-neutral-700">
          <span className="font-semibold">Expired{m.expiredAt ? ` ${day(m.expiredAt)}` : ""}:</span> &ldquo;{m.expiryReason}&rdquo; Its funds were released.
        </p>
      )}
      {m.overrideReason && (
        <p className="mb-4 rounded-xl bg-sun-50 px-4 py-3 text-sm text-sun-700 ring-1 ring-sun-500/30">
          <span className="font-semibold">MD&apos;s override:</span> &ldquo;{m.overrideReason}&rdquo;
        </p>
      )}

      <MemoSummaryCard memo={m} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <Panel title="About this request" icon={Info}>
            <MemoFacts memo={m} />
            {m.body && (
              <div className="mt-4 border-t border-neutral-100 pt-4">
                <p className="text-xs font-medium text-neutral-500">Justification</p>
                <RichTextView value={m.body} size="sm" className="mt-1 text-neutral-800" />
              </div>
            )}
          </Panel>

          <Panel title="Documents" subtitle="Against the checklist for its type and amount" icon={FileStack} hue="sky">
            <ChecklistDocuments items={m.checklist} documents={m.documents} />
          </Panel>

          <Panel title="FCU reviews" subtitle="Every check, item by item" icon={ClipboardCheck} hue="mint">
            <ReviewList reviews={m.reviews} />
          </Panel>

          {m.queries.length > 0 && (
            <Panel title="Queries" icon={MessageCircleQuestion} hue="sun">
              <QueryThreads queries={m.queries} canReply={() => false} onReply={async () => undefined} />
            </Panel>
          )}

          <Panel title="Vouchers" icon={PiggyBank} hue="mint">
            <VoucherLinks vouchers={m.vouchers} linkable={mayUseFinance(user, "vouchers")} currency={currency} />
          </Panel>

          {m.retirement && (
            <Panel title="Retirement" icon={ReceiptText} hue="coral" subtitle={retirementStatus(m.retirement.status).label}>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-neutral-500">Advanced</dt>
                  <dd className="font-semibold">
                    <Money value={m.retirement.advanced} currency={currency} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Spent</dt>
                  <dd className="font-semibold">
                    <Money value={m.retirement.spent} currency={currency} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-neutral-500">Cash returned</dt>
                  <dd className="font-semibold">
                    <Money value={m.retirement.refund} currency={currency} />
                  </dd>
                </div>
              </dl>
              {m.retirement.status === "submitted" && mayUseFinance(user, "fcu") && (
                <div className="mt-4">
                  <ButtonLink href={`/suite/finance/fcu/retirements/${m.retirement.id}?memo=${m.id}`} icon={ShieldCheck} size="sm">
                    Vet the retirement
                  </ButtonLink>
                </div>
              )}
            </Panel>
          )}
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Funds and history">
          <Panel title="Funds when it was sent" icon={PiggyBank} hue="grape">
            {m.fundsSnapshot ? (
              <FundsSnapshotView snapshot={m.fundsSnapshot} currency={currency} />
            ) : funds && m.status === "draft" ? (
              <p className="text-sm text-neutral-600">
                Not sent yet. The project has <Money value={funds.available} className="font-semibold" /> available now
                {overFunds ? ", less than this asks for." : "."}
              </p>
            ) : (
              <p className="text-sm text-neutral-500">{m.projectId ? "Recorded when it is sent." : "Charged to a cost centre: no project funds to check."}</p>
            )}
          </Panel>
          {m.expirable && m.approvedAt && (
            <Panel title="Waiting to be paid" icon={Hourglass} hue={m.pastExpiry ? "rose" : "sun"}>
              <p className="text-sm text-neutral-700">
                Approved {day(m.approvedAt)}, nothing paid and no voucher yet.
                {m.expiresOn && (m.pastExpiry ? ` Past its expiry date (${day(m.expiresOn)}): Finance may expire it and free its funds.` : ` Finance may expire it from ${day(m.expiresOn)}.`)}
              </p>
              {m.remindedAt && <p className="mt-2 text-xs text-neutral-500">The requester was reminded {day(m.remindedAt)}.</p>}
            </Panel>
          )}
          <Panel title="History" icon={History} hue="slate">
            <HistoryTimeline history={m.history} label={(s) => memoStatus(s).label} />
          </Panel>
        </aside>
      </div>

      {expiring && (
        <ReasonDialog
          title={`Expire ${m.reference ?? "this request"}?`}
          subtitle={
            m.pastExpiry
              ? `Nothing has been paid on it. Its ${amount(m.amount)} goes back to the project's available funds, and ${m.requester ?? "the requester"} is told. This can't be undone.`
              : `It may be expired from ${m.expiresOn ? day(m.expiresOn) : "its expiry date"}. You are expiring it early as a finance manager; that is logged.`
          }
          label="Why it is expired"
          placeholder="e.g. The vendor never delivered; no longer needed"
          tone="danger"
          maxLength={2000}
          confirmLabel={m.pastExpiry ? "Expire request" : "Expire early"}
          busyLabel="Expiring…"
          onClose={() => setExpiring(false)}
          onConfirm={async (why) => {
            const next = await spend.memos.expire(m.id, why, !m.pastExpiry);
            setMemo(next);
            setExpiring(false);
            setNotice("Expired. Its commitment on the project is released and the requester is told.");
          }}
        />
      )}
    </div>
  );
}
