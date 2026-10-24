"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { CounterpartyLink } from "../links";
import {
  Ban,
  BadgeCheck,
  ClipboardCheck,
  FileText,
  FilePen,
  Handshake,
  Hourglass,
  Landmark,
  PackageCheck,
  Paperclip,
  Printer,
  ReceiptText,
  Save,
  Scissors,
  ScrollText,
  Send,
  Wallet,
} from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Chip, Panel, Progress, buttonClass, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { HUE } from "@/components/workspace/modules";
import { BackLink, ErrorNote, Field, Skeleton, inputClass } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import ReasonDialog from "@/suite/finance/components/vouchers/ReasonDialog";
import { Money } from "@/suite/finance/components/banking/ui";
import { memoStatus } from "@/suite/finance/components/requests/labels";
import { when } from "@/suite/finance/components/requests/ui";
import { day } from "@/suite/finance/lib/format";
import { mayUseFinance } from "@/suite/finance/lib/finance-access";
import { mayDoOps } from "@/suite/operations/lib/operations-access";
import { dutiesRefusal, opsError, opsFieldErrors, procurement, type Grn, type PoFull, type Scc } from "@/lib/api/operations-procurement-client";
import { KIND_LABEL, poRoad, poStepDates, qty } from "./meta";
import { ApprovalLink, AttachmentsBlock, DocNo, Fact, Lifecycle, PdfLink, PoStatusChip } from "./ui";
import { PaymentTermsEditor, PaymentTermsList, termInputs, termRows, type TermRow } from "./PaymentTerms";
import { InvoiceMatch } from "./InvoiceMatch";
import ReviseOrderDialog from "./ReviseOrderDialog";
import SendTo from "@/suite/org/components/foundations/SendTo";
import { RichTextEditor } from "@/components/workspace/RichTextEditor";
import { RichTextView } from "@/components/workspace/RichTextView";

/**
 * One purchase order, from draft to paid: where it is on its road, what was
 * ordered and how much has arrived, the terms (editable while a draft), the
 * goods received notes and service certificates, the vendor's invoices with
 * their three-way match, and what Finance has raised and paid against it.
 */

const OPEN = ["approved", "sent", "accepted", "partially_received", "received", "invoiced", "partially_paid"];

type Dialog = "accept" | "cancel" | "short" | "revise" | null;

/** Statuses an order can be revised in (`PurchaseOrders::REVISABLE`). */
const REVISABLE = ["approved", "sent", "accepted", "partially_received"];

export default function OrderDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const uid = useId();
  const [po, setPo] = useState<PoFull | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [draft, setDraft] = useState<{ address: string; date: string; terms: string; rows: TermRow[] } | null>(null);
  const [termProblems, setTermProblems] = useState<Record<number, string>>({});
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});

  const take = useCallback((p: PoFull) => {
    setPo(p);
    setDraft(p.status === "draft" ? { address: p.deliveryAddress ?? "", date: p.deliveryDate ?? "", terms: p.terms ?? "", rows: termRows(p.paymentTerms) } : null);
  }, []);

  const load = useCallback(() => {
    procurement.orders.get(id).then(
      (p) => {
        take(p);
        setLoadError(null);
      },
      (e: unknown) => setLoadError(`The order didn't load. ${opsError(e)}`),
    );
  }, [id, take]);

  useEffect(() => {
    load();
  }, [load, reload]);

  if (loadError)
    return (
      <div>
        <BackLink href="/suite/operations/procurement/orders" label="Purchase orders" />
        <LoadError text={loadError} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );
  if (!po)
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the order…</p>
        <Skeleton className="h-24" />
        <Skeleton className="h-[30rem]" />
      </div>
    );

  const cur = po.currency;
  const isDraft = po.status === "draft";
  const nothingYet = !po.lines.some((l) => l.received > 0) && po.payments.memos.length === 0;
  const can = {
    update: isDraft && mayDoOps(user, "purchase_orders", "update"),
    submit: isDraft && mayDoOps(user, "purchase_orders", "submit"),
    send: po.status === "approved" && mayDoOps(user, "purchase_orders", "send"),
    accept: (po.status === "approved" || po.status === "sent") && mayDoOps(user, "purchase_orders", "accept"),
    cancel: ["draft", "in_approval", "approved", "sent", "accepted"].includes(po.status) && nothingYet && mayDoOps(user, "purchase_orders", "cancel"),
    shortClose: OPEN.includes(po.status) && !nothingYet && mayDoOps(user, "purchase_orders", "short_close"),
    revise: REVISABLE.includes(po.status) && po.pendingRevision == null && mayDoOps(user, "purchase_orders", "revise"),
    print: !["draft", "in_approval"].includes(po.status),
    approveGrn: mayDoOps(user, "receiving", "approve_grn"),
    approveScc: mayDoOps(user, "receiving", "approve_scc"),
    attach: mayDoOps(user, "attachments", "create"),
    detach: mayDoOps(user, "attachments", "delete"),
  };
  const memoHref = (memoId: string) => (mayUseFinance(user, "memos") ? `/suite/finance/memos/${memoId}` : null);

  const act = async (key: string, run: () => Promise<PoFull>, done: string) => {
    setBusy(key);
    setActionError(null);
    try {
      take(await run());
      setNotice(done);
    } catch (e) {
      setActionError(dutiesRefusal(e) ?? opsError(e));
    } finally {
      setBusy(null);
    }
  };

  /** Save the draft's editable fields; returns false (with the errors shown) when refused. */
  const saveDraft = async (): Promise<boolean> => {
    if (!draft) return true;
    const { terms, problems } = termInputs(draft.rows);
    setTermProblems(problems);
    setDraftErrors({});
    if (Object.keys(problems).length) return false;
    try {
      take(await procurement.orders.update(po.id, { deliveryAddress: draft.address.trim() || null, deliveryDate: draft.date || null, terms: draft.terms.trim() || null, paymentTerms: terms }));
      return true;
    } catch (e) {
      const f = opsFieldErrors(e);
      const placed: Record<number, string> = {};
      const rest: Record<string, string> = {};
      for (const [k, v] of Object.entries(f)) {
        const m = /^paymentTerms\.(\d+)\./.exec(k);
        if (m) placed[Number(m[1])] = v;
        else rest[k] = v;
      }
      setTermProblems(placed);
      setDraftErrors(Object.keys(rest).length || Object.keys(placed).length ? rest : { general: opsError(e) });
      return false;
    }
  };

  const onSave = async () => {
    setBusy("save");
    setActionError(null);
    if (await saveDraft()) setNotice("Draft saved.");
    setBusy(null);
  };

  const onSubmit = async () => {
    setBusy("submit");
    setActionError(null);
    if (!(await saveDraft())) {
      setBusy(null);
      return;
    }
    setBusy(null);
    await act("submit", () => procurement.orders.submit(po.id), "Sent for approval. You can send it to the vendor once it is approved.");
  };

  const onSend = async () => {
    const ok = await confirm({
      title: `Send ${po.number ?? "this order"} to ${po.vendor ?? "the vendor"}?`,
      body: "This marks the order as sent. Print it and email the PDF to the vendor, then record their acceptance when it comes.",
      confirmLabel: "Mark as sent",
      tone: "primary",
    });
    if (ok) await act("send", () => procurement.orders.send(po.id), "Marked as sent to the vendor.");
  };

  const approveNote = async (kind: "grn" | "scc", note: Grn | Scc) => {
    const ok = await confirm({
      title: `Approve ${note.number ?? (kind === "grn" ? "this GRN" : "this certificate")}?`,
      body:
        kind === "grn"
          ? "Approving adds what was accepted to the order's received quantities, so it can be invoiced and paid. Whoever raised the order or recorded the GRN can't approve it."
          : "Approving confirms the service on the order, so it can be invoiced and paid. Whoever raised the order or the certificate can't approve it.",
      confirmLabel: kind === "grn" ? "Approve the GRN" : "Approve the certificate",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(`${kind}-${note.id}`);
    setActionError(null);
    try {
      if (kind === "grn") await procurement.receiving.approveGrn(note.id);
      else await procurement.receiving.approveScc(note.id);
      setNotice(kind === "grn" ? "GRN approved. The received quantities are updated." : "Certificate approved.");
      setReload((n) => n + 1);
    } catch (e) {
      setActionError(dutiesRefusal(e) ?? opsError(e));
    } finally {
      setBusy(null);
    }
  };

  const lineOf = (poLineId: string) => po.lines.find((l) => l.id === poLineId);
  const ordered = po.lines.reduce((s, l) => s + l.quantity, 0);
  const received = po.lines.reduce((s, l) => s + Math.min(l.received, l.quantity), 0);
  const pay = po.payments;

  return (
    <div>
      <BackLink href="/suite/operations/procurement/orders" label="Purchase orders" />
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="mb-1 flex flex-wrap items-center gap-2">
            <DocNo value={po.number} className="text-primary-700" />
            <PoStatusChip status={po.status} />
            {po.revision > 0 && <Chip hue="slate">Revision {po.revision}</Chip>}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900 sm:text-[28px]">
            <CounterpartyLink id={po.vendorId} name={po.vendor} fallback="Vendor" className="hover:text-primary-700 hover:underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded" />
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {KIND_LABEL[po.kind]} · <Money value={po.total} currency={cur} className="font-semibold text-neutral-700" /> incl. VAT
          </p>
          <SendTo counterpartyId={po.vendorId} className="mt-2" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {can.cancel && (
            <Button variant="ghost" icon={Ban} onClick={() => setDialog("cancel")}>
              Cancel order
            </Button>
          )}
          {can.shortClose && (
            <Button variant="ghost" icon={Scissors} onClick={() => setDialog("short")}>
              Short-close
            </Button>
          )}
          {can.revise && (
            <Button icon={FilePen} onClick={() => setDialog("revise")} disabled={busy !== null}>
              Revise order
            </Button>
          )}
          {can.print && (
            <a href={procurement.orders.pdfUrl(po.id)} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <Printer size={17} aria-hidden />
              Print
            </a>
          )}
          {can.update && (
            <Button icon={Save} onClick={() => void onSave()} disabled={busy !== null}>
              {busy === "save" ? "Saving…" : "Save draft"}
            </Button>
          )}
          {can.submit && (
            <Button variant="primary" icon={Send} onClick={() => void onSubmit()} disabled={busy !== null}>
              {busy === "submit" ? "Sending…" : "Send for approval"}
            </Button>
          )}
          {can.send && (
            <Button variant="primary" icon={Send} onClick={() => void onSend()} disabled={busy !== null}>
              Send to vendor
            </Button>
          )}
          {can.accept && (
            <Button variant={can.send ? "secondary" : "primary"} icon={Handshake} onClick={() => setDialog("accept")}>
              Record acceptance
            </Button>
          )}
        </div>
      </div>

      <Notice text={notice} />
      {actionError && <ErrorNote className="mb-6">{actionError}</ErrorNote>}
      {po.pendingRevision && (
        <div role="status" className="mb-6 flex items-start gap-3 rounded-2xl border border-sun-500/30 bg-sun-50 px-4 py-3 text-sm text-sun-700">
          <Hourglass size={18} className="mt-0.5 shrink-0" aria-hidden />
          <p className="min-w-0">
            <span className="font-semibold">Revision {po.revision + 1} awaiting approval: </span>
            <Money value={po.pendingRevision.from} currency={cur} /> → <Money value={po.pendingRevision.to} currency={cur} className="font-semibold" />
            {po.pendingRevision.reason ? `, ${po.pendingRevision.reason}` : ""}
            <span className="block text-xs">The order keeps its current figures until the revision is approved{po.pendingRevision.at ? `; asked ${po.pendingRevision.byName ? `by ${po.pendingRevision.byName} ` : ""}${when(po.pendingRevision.at)}` : ""}.</span>
          </p>
        </div>
      )}

      <div className="mb-6 ws-card p-5">
        <Lifecycle road={poRoad(po)} dates={poStepDates(po)} label="Where this order is" />
        {po.closingReason && (
          <p className="mt-4 rounded-2xl bg-neutral-50 px-4 py-3 text-sm text-neutral-700">
            <span className="font-semibold">{po.status === "short_closed" ? "Short-closed: " : "Cancelled: "}</span>
            {po.closingReason}
          </p>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <Panel title="What is ordered" subtitle={`${qty(received)} of ${qty(ordered)} received or confirmed`} icon={ScrollText} hue="blue">
            <ul className="divide-y divide-neutral-100">
              {po.lines.map((l) => {
                const pct = l.quantity > 0 ? (Math.min(l.received, l.quantity) / l.quantity) * 100 : 0;
                return (
                  <li key={l.id} className="grid gap-3 py-3 first:pt-0 last:pb-0 sm:grid-cols-[1fr_auto]">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900">
                        <span className="tabular-nums text-neutral-500">{l.lineNo}.</span> {l.description}
                      </p>
                      <p className="mt-0.5 text-xs text-neutral-500 tabular-nums">
                        {qty(l.quantity)} {l.unit} × <Money value={l.unitPrice} currency={cur} /> · VAT {l.vatRateBp / 100}%
                      </p>
                      <div className="mt-2 max-w-sm">
                        <Progress value={pct} hue={pct >= 100 ? "mint" : "sky"} size="sm" label={`${l.kind === "service" ? "Confirmed" : "Received"} ${qty(l.received)} of ${qty(l.quantity)}`} />
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <Money value={l.amount} currency={cur} className="text-sm font-bold text-neutral-900" />
                      <p className="text-[11px] text-neutral-500">
                        + VAT <Money value={l.vat} currency={cur} />
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-neutral-50 px-4 py-3 text-sm">
              <Fact label="Subtotal">
                <Money value={po.subtotal} currency={cur} />
              </Fact>
              <Fact label="VAT">
                <Money value={po.vat} currency={cur} />
              </Fact>
              <Fact label="Total">
                <Money value={po.total} currency={cur} className="text-[15px]" />
              </Fact>
            </dl>
          </Panel>

          <Panel
            title={draft && can.update ? "Delivery and terms" : "Payment terms"}
            subtitle={draft && can.update ? "Editable while the order is a draft" : "When the vendor is paid, and where each payment is"}
            icon={Landmark}
            hue="grape"
          >
            {draft && can.update ? (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field id={`${uid}-addr`} label="Deliver to">
                    <input id={`${uid}-addr`} className={inputClass} value={draft.address} maxLength={255} onChange={(e) => setDraft({ ...draft, address: e.target.value })} />
                  </Field>
                  <Field id={`${uid}-date`} label="Deliver by">
                    <input id={`${uid}-date`} type="date" className={inputClass} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                  </Field>
                </div>
                <Field id={`${uid}-terms`} label="Terms and conditions" hint="Printed on the order">
                  <RichTextEditor id={`${uid}-terms`} minHeight={102} value={draft.terms} onChange={(html) => setDraft({ ...draft, terms: html })} placeholder="Goods to the specification quoted; warranty registered to the organisation." />
                </Field>
                <div>
                  <p className="mb-2 text-sm font-semibold text-neutral-900">Payment terms</p>
                  <PaymentTermsEditor rows={draft.rows} onChange={(rows) => setDraft({ ...draft, rows })} total={po.total} triggers={po.triggers} problems={termProblems} currency={cur} />
                </div>
                {Object.values(draftErrors).length > 0 && <ErrorNote>{Object.values(draftErrors)[0]}</ErrorNote>}
              </div>
            ) : (
              <div className="space-y-4">
                <PaymentTermsList terms={po.paymentTerms} triggers={po.triggers} total={po.total} currency={cur} />
                {po.terms && (
                  <div>
                    <p className="text-xs font-medium text-neutral-500">Terms and conditions</p>
                    <RichTextView value={po.terms} size="sm" className="mt-1 text-neutral-800" />
                  </div>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Received and confirmed" subtitle="Goods received notes and service completion certificates" icon={PackageCheck} hue="mint">
            {po.grns.length === 0 && po.sccs.length === 0 ? (
              <p className="text-sm text-neutral-500">
                Nothing received yet.{" "}
                {OPEN.includes(po.status) && (
                  <Link href="/suite/operations/procurement/receiving" className="rounded font-semibold text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                    Record it on the receiving desk
                  </Link>
                )}
              </p>
            ) : (
              <ul className="space-y-3">
                {po.grns.map((g) => (
                  <NoteCard
                    key={g.id}
                    kind="GRN"
                    number={g.number}
                    status={g.status}
                    who={`Received ${day(g.receivedOn)} by ${g.receivedBy ?? "-"}${g.deliveryNote ? ` · delivery note ${g.deliveryNote}` : ""}`}
                    approved={g.approvedBy ? `Approved by ${g.approvedBy}, ${when(g.approvedAt)}` : null}
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <PdfLink href={procurement.receiving.grnPdfUrl(g.id)} label="Print" name={g.number} />
                        {g.status === "draft" && can.approveGrn && (
                          <Button size="sm" variant="primary" icon={BadgeCheck} disabled={busy !== null} onClick={() => void approveNote("grn", g)}>
                            {busy === `grn-${g.id}` ? "Approving…" : "Approve GRN"}
                          </Button>
                        )}
                      </div>
                    }
                  >
                    <ul className="mt-2 space-y-1 text-xs text-neutral-600">
                      {g.lines.map((l) => (
                        <li key={l.poLineId}>
                          Line {lineOf(l.poLineId)?.lineNo ?? "?"}: {qty(l.received)} arrived, {qty(l.accepted)} accepted
                          {l.rejected ? `, ${qty(l.rejected)} rejected` : ""}
                          {l.serials.length > 0 && <span className="block font-mono text-[11px] text-neutral-500">{l.serials.join(" · ")}</span>}
                        </li>
                      ))}
                    </ul>
                  </NoteCard>
                ))}
                {po.sccs.map((s) => (
                  <NoteCard
                    key={s.id}
                    kind="SCC"
                    number={s.number}
                    status={s.status}
                    who={`Raised by ${s.raisedBy ?? "-"}${s.periodTo ? ` · service ${s.periodFrom ? `${day(s.periodFrom)} to ` : ""}${day(s.periodTo)}` : ""}${s.rating ? ` · rated ${s.rating} of 5` : ""}`}
                    approved={s.approvedBy ? `Approved by ${s.approvedBy}, ${when(s.approvedAt)}` : null}
                    action={
                      <div className="flex flex-wrap items-center gap-2">
                        <PdfLink href={procurement.receiving.sccPdfUrl(s.id)} label="Print" name={s.number} />
                        {s.status === "draft" && can.approveScc && (
                          <Button size="sm" variant="primary" icon={BadgeCheck} disabled={busy !== null} onClick={() => void approveNote("scc", s)}>
                            {busy === `scc-${s.id}` ? "Approving…" : "Approve certificate"}
                          </Button>
                        )}
                      </div>
                    }
                  >
                    {s.comments && <p className="mt-2 text-xs text-neutral-600">&ldquo;{s.comments}&rdquo;</p>}
                  </NoteCard>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Vendor invoices" subtitle="Each held against the order and what was received" icon={ReceiptText} hue="coral">
            {po.invoices.length === 0 ? (
              <p className="text-sm text-neutral-500">No invoice recorded yet. Invoices are recorded on the receiving desk once goods or services are approved.</p>
            ) : (
              <div className="space-y-3">
                {po.invoices.map((inv) => (
                  <InvoiceMatch key={inv.id} invoice={inv} currency={cur} memoHref={memoHref} />
                ))}
              </div>
            )}
          </Panel>
        </div>

        <aside className="min-w-0 space-y-6" aria-label="About this order">
          <Panel title="Payments from Finance" icon={Wallet} hue="sky">
            {!po.financeOn ? (
              <p className="text-sm text-neutral-600">Finance isn&apos;t switched on for this organisation, so payments wait for Finance. Advances and matched invoices become payment memos once it is.</p>
            ) : (
              <div className="space-y-4">
                <PaidMeter paid={pay.paid} raised={pay.raised} total={po.total} currency={cur} />
                <dl className="grid grid-cols-2 gap-3">
                  <Fact label="Advance">
                    <Money value={pay.advance} currency={cur} />
                  </Fact>
                  <Fact label="Advance deducted">
                    <Money value={pay.advanceDeducted} currency={cur} />
                  </Fact>
                  <Fact label="Raised with the FCU">
                    <Money value={pay.raised} currency={cur} />
                  </Fact>
                  <Fact label="Paid">
                    <Money value={pay.paid} currency={cur} />
                  </Fact>
                </dl>
                {pay.memos.length === 0 ? (
                  <p className="text-sm text-neutral-500">No payment memo yet. An advance is raised when the order is approved; the rest when a matched invoice is recorded.</p>
                ) : (
                  <ul className="space-y-2">
                    {pay.memos.map((m) => {
                      const st = memoStatus(m.status ?? "");
                      const href = memoHref(m.memoId);
                      const body = (
                        <>
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-neutral-900">{m.label}</span>
                            <span className="block font-mono text-[11px] text-neutral-500">{m.reference ?? "No reference yet"}</span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end gap-1">
                            <Money value={m.amount ?? 0} currency={cur} className="text-sm font-bold text-neutral-900" />
                            <Chip hue={st.hue} icon={st.icon} className="!px-2 !py-0.5 !text-[11px]">
                              {st.label}
                            </Chip>
                          </span>
                        </>
                      );
                      return (
                        <li key={m.memoId}>
                          {href ? (
                            <Link href={href} className="flex min-h-11 items-start justify-between gap-3 rounded-2xl border border-neutral-100 px-3 py-2.5 outline-none transition hover:border-primary-200 hover:bg-primary-50/40 focus-visible:ring-2 focus-visible:ring-primary-300">
                              {body}
                            </Link>
                          ) : (
                            <div className="flex items-start justify-between gap-3 rounded-2xl border border-neutral-100 px-3 py-2.5">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </Panel>

          <Panel title="Order details" icon={FileText} hue="slate">
            <dl className="grid grid-cols-2 gap-4">
              <Fact label="Deliver by">{po.deliveryDate ? day(po.deliveryDate) : "-"}</Fact>
              <Fact label="Charged to">{po.project ? `${po.project.code ?? po.project.name}` : "Cost centre"}</Fact>
              <Fact label="Deliver to" className="col-span-2">
                {po.deliveryAddress || "-"}
              </Fact>
              <Fact label="From request">
                {po.prId ? (
                  <Link href={`/suite/operations/procurement/requests/${po.prId}`} className="rounded font-mono text-[13px] text-primary-700 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-300">
                    {po.prNumber ?? "The request"}
                  </Link>
                ) : (
                  "-"
                )}
              </Fact>
              <Fact label="Raised by">{po.createdBy ?? "-"}</Fact>
              <Fact label="Sent to vendor">{po.sentAt ? when(po.sentAt) : "Not yet"}</Fact>
              <Fact label="Accepted">{po.acceptedAt ? when(po.acceptedAt) : "Not yet"}</Fact>
              {po.acceptanceNote && (
                <Fact label="Acceptance note" className="col-span-2">
                  {po.acceptanceNote}
                </Fact>
              )}
            </dl>
            {po.approvalId && (
              <div className="mt-4">
                <ApprovalLink id={po.approvalId} />
              </div>
            )}
          </Panel>

          <Panel title="Files" icon={Paperclip} hue="slate">
            <AttachmentsBlock
              ownerType="po"
              ownerId={po.id}
              attachments={po.attachments}
              canAdd={can.attach}
              canRemove={can.detach}
              addLabel="Attach the signed order or correspondence"
              empty="No files on this order yet."
              onChange={() => setReload((n) => n + 1)}
            />
          </Panel>
        </aside>
      </div>

      {dialog === "accept" && (
        <ReasonDialog
          title="Record the vendor's acceptance"
          subtitle={`${po.vendor ?? "The vendor"} has agreed to supply ${po.number ?? "this order"}.`}
          label="How they accepted"
          hint="By email, a signed copy, a call: whatever you would show an auditor."
          single
          maxLength={255}
          confirmLabel="Record acceptance"
          busyLabel="Recording…"
          placeholder="Accepted by email, 22 Sep"
          onClose={() => setDialog(null)}
          onConfirm={async (note) => {
            take(await procurement.orders.accept(po.id, note));
            setDialog(null);
            setNotice("Acceptance recorded. Goods and services can be received against it.");
          }}
        />
      )}
      {dialog === "cancel" && (
        <ReasonDialog
          title={`Cancel ${po.number ?? "this order"}?`}
          subtitle="The order is cancelled and the funds it held go back to the project. Nothing has been received or paid on it. This can't be undone."
          label="Reason"
          confirmLabel="Cancel the order"
          busyLabel="Cancelling…"
          tone="danger"
          placeholder="Why the order is being cancelled"
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            take(await procurement.orders.cancel(po.id, reason));
            setDialog(null);
            setNotice("Order cancelled.");
          }}
        />
      )}
      {dialog === "revise" && (
        <ReviseOrderDialog
          po={po}
          onClose={() => setDialog(null)}
          onRevised={(p, applied) => {
            take(p);
            setDialog(null);
            setNotice(applied ? `Revised. This is now revision ${p.revision}.` : "Revision sent for approval. The order keeps its current figures until it is approved.");
          }}
        />
      )}
      {dialog === "short" && (
        <ReasonDialog
          title={`Short-close ${po.number ?? "this order"}?`}
          subtitle="Use this when the rest of the order will never come. What was received and invoiced stays; whatever was not used is released back to the project. This can't be undone."
          label="Reason"
          confirmLabel="Short-close the order"
          busyLabel="Closing…"
          tone="danger"
          placeholder="Why the rest of the order won't be completed"
          onClose={() => setDialog(null)}
          onConfirm={async (reason) => {
            take(await procurement.orders.shortClose(po.id, reason));
            setDialog(null);
            setNotice("Order short-closed.");
          }}
        />
      )}
    </div>
  );
}

function NoteCard({
  kind,
  number,
  status,
  who,
  approved,
  action,
  children,
}: {
  kind: "GRN" | "SCC";
  number: string | null;
  status: string;
  who: string;
  approved: string | null;
  action: React.ReactNode;
  children?: React.ReactNode;
}) {
  const draft = status === "draft";
  return (
    <li className="rounded-2xl border border-neutral-100 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className={cx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", kind === "GRN" ? HUE.mint.soft : HUE.grape.soft)}>
            {kind === "GRN" ? <PackageCheck size={16} aria-hidden /> : <ClipboardCheck size={16} aria-hidden />}
          </span>
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-2">
              <DocNo value={number ?? `Draft ${kind}`} className="text-neutral-800" />
              <Chip hue={draft ? "sun" : "mint"} className="!px-2 !py-0.5 !text-[11px]">
                {draft ? "Waiting for approval" : "Approved"}
              </Chip>
            </p>
            <p className="mt-0.5 text-xs text-neutral-500">{who}</p>
            {approved && <p className="text-xs text-neutral-500">{approved}</p>}
          </div>
        </div>
        {action}
      </div>
      {children}
    </li>
  );
}

/** Paid of the order, with what has been raised but not paid hatched between. */
function PaidMeter({ paid, raised, total, currency }: { paid: number; raised: number; total: number; currency: string }) {
  const of = Math.max(1, total);
  const p = Math.min(100, (paid / of) * 100);
  const r = Math.min(100 - p, (Math.max(0, raised - paid) / of) * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-neutral-600">Paid</span>
        <span>
          <Money value={paid} currency={currency} className="font-bold text-neutral-900" /> <span className="text-xs text-neutral-500">of</span> <Money value={total} currency={currency} className="text-xs text-neutral-500" />
        </span>
      </div>
      <div className="ws-hatch mt-2 flex h-2.5 overflow-hidden rounded-full" aria-hidden>
        <span className="h-full bg-mint-500" style={{ width: `${p}%` }} />
        <span className="h-full bg-sky-500/60" style={{ width: `${r}%` }} />
      </div>
      <p className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-neutral-500">
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-mint-500" aria-hidden />
          Paid
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-sky-500/60" aria-hidden />
          Raised, not yet paid
        </span>
      </p>
    </div>
  );
}
