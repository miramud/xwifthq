"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  Ban,
  BadgeCheck,
  BookOpen,
  CalendarClock,
  ExternalLink,
  FileText,
  Landmark,
  MessageSquare,
  Paperclip,
  PenLine,
  Printer,
  Send,
  ShieldCheck,
  Upload,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { errorText, plainError, spend, type FcuReviewRecord, type VoucherDetail as Voucher } from "@/lib/api/finance-payments-client";
import { isBudgetExceeded } from "@/lib/api/finance-budgets-client";
import { BudgetCheckPanel, BudgetRefusal } from "@/suite/finance/components/budgets/BudgetCheckPanel";
import { Button, Card, Chip, Panel, buttonClass, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { BackLink, ErrorNote, Skeleton } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import { mayDo } from "@/suite/finance/lib/finance-access";
import { accounting, amount, day } from "@/suite/finance/lib/format";
import type { CurrencyCode } from "@/lib/money";
import { BANK_SOURCE, CHECKPOINTS, KIND_LABEL, MARK, OUTCOME, pct, signatures, statusLabel } from "./meta";
import { amountInWords } from "./words";
import { PvNumber, VoucherPipeline, VoucherStatusChip } from "./ui";
import ReasonDialog from "./ReasonDialog";
import VoucherEditor from "./VoucherEditor";
import { RichTextView } from "@/components/workspace/RichTextView";
import { richExcerpt } from "@/lib/richText";

/**
 * One payment voucher, laid out like the paper one: the number, the payee,
 * the amount in figures and in words, the coding lines, and the signatures
 * down the side - prepared, FCU checked, authorised, paid, confirmed. Above
 * it, where the voucher is on its way to the bank; below, the FCU's marks,
 * queries, documents and the journals it posted.
 */

const when = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${day(iso)}, ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
};

export default function VoucherDetail({ id }: { id: string }) {
  const params = useSearchParams();
  const editing = params?.get("edit") === "1";
  if (editing) return <VoucherEditor voucherId={id} />;
  return <VoucherView id={id} />;
}

function VoucherView({ id }: { id: string }) {
  const params = useSearchParams();
  const { user } = useAuth();
  const confirm = useConfirm();
  const uid = useId();
  const [pv, setPv] = useState<Voucher | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  // A BLOCK refusal from the budget check, shown as its own panel; the editor passes one along when sending failed there.
  const [refusal, setRefusal] = useState<string | null>(() => {
    const r = params?.get("refusal");
    return r && isBudgetExceeded(r) ? r : null;
  });
  const [notice, setNotice] = useState<string | null>(() => {
    const n = params?.get("notice");
    if (!n) return null;
    if (n === "saved") return "Voucher saved as a draft.";
    if (n === "submitted") return "Voucher sent to the FCU for its pre-audit.";
    return n;
  });

  const load = useCallback(() => {
    spend.vouchers.get(id).then(
      (v) => {
        setPv(v);
        setLoadError(null);
      },
      (e: unknown) => setLoadError(plainError(e, "The voucher didn't load.")),
    );
  }, [id]);

  useEffect(() => {
    load();
  }, [load, reload]);

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/finance/vouchers" label="All vouchers" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!pv) return <Skeleton className="h-[34rem]" />;

  const currency = pv.currency as CurrencyCode;
  const mine = user?.id === pv.preparedById;
  const open = pv.status === "draft" || pv.status === "fcu_queried";
  const canEdit = open && mine && mayDo(user, "vouchers", "update");
  const canSubmit = open && mine && mayDo(user, "vouchers", "submit");
  const canApprove = pv.status === "fcu_checked" && !pv.approvalId && mayDo(user, "vouchers", "approve");
  const canCancel = !["payment_initiated", "paid_confirmed", "cancelled", "rejected"].includes(pv.status) && mayDo(user, "vouchers", "cancel");
  const stopped = pv.status === "cancelled" || pv.status === "rejected";
  const stopStep = stopped ? [...pv.history].reverse().find((h) => h.to === pv.status) : undefined;

  const act = async (key: string, run: () => Promise<Voucher>, done: string) => {
    setBusy(key);
    setActionError(null);
    try {
      setPv(await run());
      setNotice(done);
    } catch (e) {
      setActionError(plainError(e));
    } finally {
      setBusy(null);
    }
  };

  const send = async () => {
    setBusy("submit");
    setActionError(null);
    setRefusal(null);
    try {
      setPv(await spend.vouchers.submit(pv.id));
      setNotice("Voucher sent to the FCU for its pre-audit.");
    } catch (e) {
      const raw = errorText(e);
      if (isBudgetExceeded(raw)) setRefusal(raw);
      else setActionError(plainError(e));
    } finally {
      setBusy(null);
    }
  };

  const approve = async () => {
    const ok = await confirm({
      title: `Approve ${pv.pvNo}?`,
      body: `Approving posts the accrual journal for ${amount(pv.net, currency)} net payable to ${pv.payee}, and the voucher joins the queue to be paid. Nobody who requested, prepared or checked it may approve it.`,
      confirmLabel: "Approve voucher",
      tone: "primary",
    });
    if (ok) await act("approve", () => spend.vouchers.approve(pv.id), "Voucher approved. The accrual is posted and it is ready to be paid.");
  };

  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy("upload");
    setActionError(null);
    try {
      const docs = await spend.vouchers.upload(pv.id, file);
      setPv((v) => (v ? { ...v, documents: docs } : v));
      setNotice(`${file.name} attached.`);
    } catch (e) {
      setActionError(plainError(e, "The file wasn't attached."));
    } finally {
      setBusy(null);
    }
  };

  const sigs = signatures(pv.history, pv.preparedBy);
  const pvReviews = pv.reviews.filter((r) => r.checkpoint === 2 || r.checkpoint === 3);

  return (
    <div>
      <BackLink href="/suite/finance/vouchers" label="All vouchers" />
      <Notice text={notice} />

      {/* The voucher's face: number, payee, amount in figures and words. */}
      <Card className="relative mb-5 overflow-hidden p-5 sm:p-6">
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary-600 via-sky-500 to-mint-500" />
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-primary-600">{KIND_LABEL[pv.kind] ?? "Payment"} voucher</p>
            <h1 className="mt-2">
              <span className="sr-only">Voucher </span>
              <PvNumber value={pv.pvNo} size="xl" />
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <VoucherStatusChip status={pv.status} />
              {pv.provisional && <Chip hue="sun">Provisional: bank receipt only</Chip>}              <span className="text-sm text-neutral-500">Dated {day(pv.date)}</span>
            </div>
            <p className="mt-4 text-sm text-neutral-500">Pay</p>
            <p className="text-lg font-semibold text-neutral-900">
              {pv.payee} <span className="text-sm font-medium text-neutral-500">· {pv.payeeKind === "staff" ? "Staff" : "Vendor"}</span>
            </p>
            {pv.payeeBank ? (
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-sm text-neutral-600">
                <Landmark size={14} className="text-neutral-400" aria-hidden />
                {pv.payeeBank.accountName} · {pv.payeeBank.bankName} · <span className="font-mono tabular-nums">•••• {pv.payeeBank.last4}</span>
                <span className="text-xs text-neutral-500">({(BANK_SOURCE[pv.payeeBank.source ?? ""] ?? "From the master record").toLowerCase()})</span>
              </p>
            ) : (
              <p className="mt-1 flex items-start gap-1.5 text-sm font-medium text-sun-700">
                <AlertTriangle size={15} className="mt-0.5 shrink-0" aria-hidden />
                No bank account on record for this payee.{" "}
                {pv.payeeKind === "staff" ? "HR records the salary account." : "Add and approve one in the vendor register."}
              </p>
            )}
          </div>
          <div className="lg:max-w-sm lg:text-right">
            <p className="text-sm text-neutral-500">Net payable</p>
            <p className="text-[32px] font-bold leading-tight tracking-tight tabular-nums text-neutral-900">{amount(pv.net, currency)}</p>
            <p className="mt-1 text-sm italic text-neutral-600">{amountInWords(pv.net, currency)}</p>
            <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
              <a href={spend.vouchers.pdfUrl(pv.id)} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
                <Printer size={15} aria-hidden />
                Print voucher
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
              {canEdit && (
                <Link href={`/suite/finance/vouchers/${pv.id}?edit=1`} className={buttonClass("secondary", "sm")}>
                  <PenLine size={15} aria-hidden />
                  Edit
                </Link>
              )}
              {canCancel && (
                <Button size="sm" variant="ghost" icon={Ban} onClick={() => setCancelling(true)} disabled={busy !== null}>
                  Cancel voucher
                </Button>
              )}
              {canApprove && (
                <Button size="sm" variant="primary" icon={BadgeCheck} onClick={approve} disabled={busy !== null}>
                  {busy === "approve" ? "Approving…" : "Approve voucher"}
                </Button>
              )}
              {canSubmit && (
                <Button
                  size="sm"
                  variant="primary"
                  icon={Send}
                  onClick={send}
                  disabled={busy !== null}
                >
                  {busy === "submit" ? "Sending…" : pv.status === "fcu_queried" ? "Send back to FCU" : "Send to FCU"}
                </Button>
              )}
            </div>
          </div>
        </div>
        {actionError && <ErrorNote className="mt-4">{actionError}</ErrorNote>}
        {canApprove && !actionError && (
          <p className="mt-4 rounded-xl bg-grape-50 px-4 py-3 text-sm text-grape-700">
            The FCU has checked this voucher and the voucher approval process is switched off, so a second person approves it here.
          </p>
        )}
        {open && !mine && (
          <p className="mt-4 text-xs text-neutral-500">Only {pv.preparedBy ?? "the person who prepared it"} can change or send this voucher.</p>
        )}
      </Card>

      {refusal && <BudgetRefusal message={refusal} className="mb-5" />}
      {pv.budgetCheck && !refusal && <BudgetCheckPanel check={pv.budgetCheck} currency={pv.currency} className="mb-5" />}

      {stopped ? (
        <ErrorNote className="mb-5">
          <span className="flex items-start gap-2">
            {pv.status === "cancelled" ? <Ban size={16} className="mt-0.5 shrink-0" aria-hidden /> : <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden />}
            <span>
              {pv.status === "cancelled" ? "Cancelled" : "Rejected"}
              {stopStep?.by ? ` by ${stopStep.by}` : ""}
              {stopStep?.at ? ` on ${day(stopStep.at)}` : ""}
              {stopStep?.comment ? `: ${richExcerpt(stopStep.comment, 300)}` : "."} The number {pv.pvNo} stays in the register, so the sequence has no gaps.
            </span>
          </span>
        </ErrorNote>
      ) : (
        <Card className="mb-5 px-4 py-5 sm:px-6">
          <VoucherPipeline status={pv.status} />
        </Card>
      )}

      {pv.failures.length > 0 && (
        <div className="mb-5 rounded-[1.125rem] border border-rose-500/20 bg-rose-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose-700">
            <AlertTriangle size={16} aria-hidden />
            {pv.failures.length === 1 ? "A payment attempt failed" : `${pv.failures.length} payment attempts failed`}
          </p>
          <ul className="mt-2 space-y-1.5 text-sm text-rose-700">
            {pv.failures.map((f, i) => (
              <li key={i}>
                {day(f.at)}: {f.reason}
                {f.cibReference && <span className="font-mono text-xs"> (bank reference {f.cibReference})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel title="Lines" subtitle={pv.narration ?? undefined} icon={FileText} bodyClassName="p-0 pt-4">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <caption className="sr-only">Voucher lines and totals</caption>
                <thead>
                  <tr className="border-y border-neutral-100 bg-neutral-50/70 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <th scope="col" className="py-2.5 pl-5 pr-2">Account</th>
                    <th scope="col" className="px-2 py-2.5">Description</th>
                    <th scope="col" className="px-2 py-2.5 text-right">Gross</th>
                    <th scope="col" className="px-2 py-2.5 text-right">VAT</th>
                    <th scope="col" className="px-2 py-2.5 text-right">WHT</th>
                    <th scope="col" className="py-2.5 pl-2 pr-5 text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {pv.lines.map((l) => (
                    <tr key={l.lineNo} className="border-b border-neutral-100 align-top">
                      <td className="py-3 pl-5 pr-2">
                        <span className="font-mono text-[13px] text-neutral-500">{l.account?.code}</span>{" "}
                        <span className="font-medium text-neutral-900">{l.account?.name ?? "-"}</span>
                      </td>
                      <td className="px-2 py-3 text-neutral-700">{l.description}</td>
                      <td className="px-2 py-3 text-right tabular-nums">{accounting(l.gross)}</td>
                      <td className="px-2 py-3 text-right tabular-nums text-neutral-600">{l.vat ? accounting(l.vat) : "-"}</td>
                      <td className="px-2 py-3 text-right tabular-nums text-neutral-600">
                        {l.wht ? `−${accounting(l.wht)}` : "-"}
                        <span className={cx("block text-[11px]", l.whtOverrideReason ? "font-semibold text-sun-700" : "text-neutral-500")}>
                          {l.whtCode === "none" ? "No WHT" : `${l.whtCode} ${pct(l.whtRateBp)}`}
                          {l.whtOverrideReason && " · changed"}
                        </span>
                        {l.whtOverrideReason && <span className="block text-[11px] text-neutral-500">{l.whtOverrideReason}</span>}
                      </td>
                      <td className="py-3 pl-2 pr-5 text-right font-semibold tabular-nums text-neutral-900">{accounting(l.net)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-neutral-50/70 font-semibold text-neutral-900">
                    <th scope="row" colSpan={2} className="py-3 pl-5 pr-2 text-left">
                      Totals
                    </th>
                    <td className="px-2 py-3 text-right tabular-nums">{accounting(pv.gross)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{accounting(pv.vat)}</td>
                    <td className="px-2 py-3 text-right tabular-nums">{pv.wht ? `−${accounting(pv.wht)}` : "-"}</td>
                    <td className="py-3 pl-2 pr-5 text-right tabular-nums">{amount(pv.net, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="border-t border-neutral-100 px-5 py-3 text-sm text-neutral-600">
              <span className="font-medium text-neutral-500">Amount in words: </span>
              {amountInWords(pv.net, currency)}
            </p>
          </Panel>

          <Panel title="FCU checks" icon={ShieldCheck} hue="grape" subtitle="The Finance Control Unit's marks on this voucher">
            {pvReviews.length === 0 ? (
              <p className="text-sm text-neutral-500">
                {pv.status === "draft" ? "Not sent to the FCU yet." : pv.status === "submitted_to_fcu" ? "With the FCU now." : "No checks recorded on this voucher."}
              </p>
            ) : (
              <div className="space-y-5">
                {pvReviews.map((r) => (
                  <ReviewBlock key={r.id} review={r} />
                ))}
              </div>
            )}
          </Panel>

          {pv.queries.length > 0 && (
            <Panel title="Queries" icon={MessageSquare} hue="sun">
              <ul className="space-y-4">
                {pv.queries.map((q) => (
                  <li key={q.id} className="rounded-xl border border-neutral-200/80 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-neutral-900">
                        {CHECKPOINTS[q.checkpoint] ?? "Query"} · raised by {q.raisedBy ?? "the FCU"}
                      </p>
                      <Chip hue={q.status === "open" ? "sun" : "mint"}>{q.status === "open" ? "Open" : q.status === "answered" ? "Answered" : "Closed"}</Chip>
                    </div>
                    <ol className="mt-3 space-y-2">
                      {q.messages.map((m) => (
                        <li key={m.id} className="text-sm text-neutral-700">
                          <span className="font-semibold text-neutral-900">{m.author ?? "Someone"}: </span>
                          {m.body}
                          {m.at && <span className="ml-1 text-xs text-neutral-500">{when(m.at)}</span>}
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-neutral-500">Answer a query from the FCU desk; change the voucher with Edit, then send it back.</p>
            </Panel>
          )}
        </div>

        <aside className="space-y-5">
          <Panel title="Signatures" icon={PenLine} subtitle="Each stage, who signed it and when">
            <ol className="relative space-y-4">
              <span aria-hidden className="absolute bottom-2 left-[13px] top-2 w-px bg-neutral-200" />
              {sigs.map((s) => (
                <li key={s.label} className="relative flex gap-3">
                  <span
                    className={cx(
                      "relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-4 ring-white",
                      s.signed ? "bg-mint-50 text-mint-700" : "ws-hatch text-neutral-400",
                    )}
                  >
                    {s.signed ? <BadgeCheck size={15} aria-hidden /> : <span className="h-1.5 w-1.5 rounded-full bg-neutral-400" aria-hidden />}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-900">{s.label}</p>
                    <p className="text-sm text-neutral-600">{s.signed ? (s.by ?? "Recorded") : "Not yet"}</p>
                    {s.at && <p className="text-xs text-neutral-500">{when(s.at)}</p>}
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Payment" icon={Landmark} hue="sky">
            <dl className="space-y-3 text-sm">
              <Row label="Paid from">{pv.payingBankAccount ?? <span className="text-sun-700">Not chosen yet</span>}</Row>
              {pv.scheduleId && (
                <Row label="Schedule">
                  <Link href={`/suite/finance/payments/${pv.scheduleId}`} className="font-semibold text-primary-700 hover:underline">
                    Open the payment schedule
                  </Link>
                </Row>
              )}
              {pv.cibReference && (
                <Row label="Bank reference">
                  <span className="font-mono">{pv.cibReference}</span>
                </Row>
              )}
              {pv.initiatedAt && <Row label="Sent">{when(pv.initiatedAt)}</Row>}
              {pv.confirmedAt && <Row label="Confirmed">{when(pv.confirmedAt)}</Row>}
              {pv.amountPaid != null && pv.amountPaid !== pv.net && <Row label="Bank debited">{amount(pv.amountPaid, currency)}</Row>}
              {pv.confirmationEvidence && (
                <Row label="Evidence">{pv.confirmationEvidence === "statement_line" ? "Bank statement line" : pv.confirmationEvidence === "cib_receipt" ? "Bank receipt (provisional)" : pv.confirmationEvidence}</Row>
              )}
            </dl>
          </Panel>

          <Panel title="Linked records" icon={BookOpen} hue="slate">
            <ul className="space-y-2.5 text-sm">
              {pv.memos.map((m) => (
                <li key={m.id}>
                  <Link href={`/suite/finance/memos/${m.id}`} className="group flex items-start justify-between gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary-300">
                    <span className="min-w-0">
                      <span className="block text-xs text-neutral-500">Request</span>
                      <span className="font-semibold text-primary-700 group-hover:underline">{m.reference}</span>{" "}
                      <span className="text-neutral-600">{m.title}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-neutral-700">{amount(m.amount, currency)}</span>
                  </Link>
                </li>
              ))}
              <LinkRow href={pv.approvalId ? `/suite/approvals/${pv.approvalId}` : null} label="Authorisation" text="Open the approval" missing="Not sent for authorisation" />
              <LinkRow href={pv.accrualJournalId ? `/suite/finance/journals/${pv.accrualJournalId}` : null} label="Accrual journal" text="Open the journal" missing="Posted when the voucher is approved" />
              <LinkRow href={pv.paymentJournalId ? `/suite/finance/journals/${pv.paymentJournalId}` : null} label="Payment journal" text="Open the journal" missing="Posted when the FCU confirms payment" />
            </ul>
          </Panel>

          <Panel
            title="Documents"
            icon={Paperclip}
            hue="coral"
            actions={
              mayDo(user, "vouchers", "upload") && !stopped ? (
                <label className={cx(buttonClass("secondary", "sm"), "focus-within:ring-2 focus-within:ring-primary-200")}>
                  <Upload size={15} aria-hidden />
                  {busy === "upload" ? "Attaching…" : "Attach"}
                  <input id={`${uid}-file`} type="file" className="sr-only" disabled={busy !== null} onChange={(e) => upload(e.target.files?.[0])} />
                </label>
              ) : undefined
            }
          >
            {pv.documents.length === 0 ? (
              <p className="text-sm text-neutral-500">No documents attached to the voucher. The request&apos;s own documents are on the request.</p>
            ) : (
              <ul className="space-y-2.5">
                {pv.documents.map((d) => (
                  <li key={d.id} className="flex items-start gap-3 text-sm">
                    <FileText size={16} className="mt-0.5 shrink-0 text-neutral-400" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-neutral-900">{d.fileName}</span>
                      <span className="block text-xs text-neutral-500">
                        {d.uploadedBy ?? "Someone"}
                        {d.uploadedAt ? `, ${day(d.uploadedAt)}` : ""}
                        {d.size ? ` · ${Math.max(1, Math.round(d.size / 1024))} KB` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {pv.history.length > 0 && (
            <Panel title="History" icon={CalendarClock} hue="slate">
              <ol className="space-y-2.5 text-sm">
                {[...pv.history].reverse().map((h, i) => (
                  <li key={i}>
                    <span className="font-medium text-neutral-900">{statusLabel(h.to)}</span>
                    <span className="text-neutral-600">{h.by ? ` · ${h.by}` : ""}</span>
                    {h.comment && <span className="block text-xs text-neutral-600">{richExcerpt(h.comment, 300)}</span>}
                    {h.at && <span className="block text-xs text-neutral-500">{when(h.at)}</span>}
                  </li>
                ))}
              </ol>
            </Panel>
          )}
        </aside>
      </div>

      {cancelling && (
        <ReasonDialog
          title={`Cancel ${pv.pvNo}?`}
          subtitle={
            pv.accrualJournalId
              ? "The accrual journal is reversed and the money goes back to the request. The number stays in the register."
              : "The money goes back to the request. The number stays in the register, so the sequence has no gaps."
          }
          label="Why it is cancelled"
          placeholder="e.g. Duplicate of PV/2026/10/0004"
          confirmLabel="Cancel voucher"
          busyLabel="Cancelling…"
          tone="danger"
          onClose={() => setCancelling(false)}
          onConfirm={async (reason) => {
            const v = await spend.vouchers.cancel(pv.id, reason);
            setPv(v);
            setCancelling(false);
            setNotice(`${pv.pvNo} cancelled.`);
          }}
        />
      )}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="text-right font-medium text-neutral-900">{children}</dd>
    </div>
  );
}

function LinkRow({ href, label, text, missing }: { href: string | null; label: string; text: string; missing: string }) {
  return (
    <li>
      <span className="block text-xs text-neutral-500">{label}</span>
      {href ? (
        <Link href={href} className="inline-flex items-center gap-1 font-semibold text-primary-700 hover:underline">
          {text}
          <ExternalLink size={13} aria-hidden />
        </Link>
      ) : (
        <span className="text-neutral-500">{missing}</span>
      )}
    </li>
  );
}

function ReviewBlock({ review: r }: { review: FcuReviewRecord }) {
  const o = OUTCOME[r.outcome] ?? { label: r.outcome, hue: "slate" as const };
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-900">
          {CHECKPOINTS[r.checkpoint] ?? "Check"} · {r.reviewer ?? "FCU"}
          {r.at && <span className="ml-1 font-normal text-neutral-500">{day(r.at)}</span>}
        </p>
        <Chip hue={o.hue}>{o.label}</Chip>
      </div>
      {r.items && r.items.length > 0 && (
        <ul className="mt-3 divide-y divide-neutral-100 rounded-xl border border-neutral-200/80">
          {r.items.map((it) => {
            const m = MARK[it.result] ?? MARK.na;
            return (
              <li key={it.code} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                <span className="min-w-0 text-neutral-700">
                  {it.label}
                  {it.comment && <span className="mt-0.5 block text-xs text-neutral-500">{it.comment}</span>}
                </span>
                <Chip hue={m.hue} className="shrink-0">
                  {m.label}
                </Chip>
              </li>
            );
          })}
        </ul>
      )}
      {r.comment && <RichTextView value={r.comment} size="sm" className="mt-2 text-neutral-600" />}
    </div>
  );
}
