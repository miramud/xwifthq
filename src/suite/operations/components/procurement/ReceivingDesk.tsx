"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CalendarClock, ClipboardCheck, Download, FileWarning, Inbox, PackageCheck, PackageOpen, ReceiptText, XCircle } from "lucide-react";
import { useAuth } from "@/lib/auth-store";
import { Button, Chip, Empty, PageHeader, Panel, StatGrid, cx } from "@/components/workspace/kit";
import { useConfirm } from "@/components/workspace/ConfirmDialog";
import { ErrorNote, Skeleton, StatCard } from "@/suite/lms/components/ui/ws";
import { LoadError, Notice } from "@/suite/org/components/foundations/shared";
import ReasonDialog from "@/suite/finance/components/vouchers/ReasonDialog";
import { Money } from "@/suite/finance/components/banking/ui";
import { day } from "@/suite/finance/lib/format";
import { mayUseFinance } from "@/suite/finance/lib/finance-access";
import { mayDoOps, mayUseOperations } from "@/suite/operations/lib/operations-access";
import { dutiesRefusal, opsError, procurement, type Grn, type ReceivableOrder, type ReceivingDesk as Desk, type Scc, type VendorInvoice } from "@/lib/api/operations-procurement-client";
import { csvAmount, csvDate, csvName, downloadCsv } from "@/components/workspace/csv";
import { CounterpartyLink } from "../links";
import { isPast, poStatus, qty } from "./meta";
import { DocNo, PdfLink, PoStatusChip } from "./ui";
import { InvoiceMatch } from "./InvoiceMatch";
import { GrnDialog, InvoiceDialog, SccDialog } from "./ReceivingDialogs";

/**
 * The receiving desk: orders waiting for their goods or services, notes
 * waiting for a second person to approve them, and vendor invoices, each
 * matched against the order and what was received the moment it is entered.
 * Separation of duties is the API's: whoever raised an order or recorded a
 * note cannot approve it, and the refusal is shown as it is given.
 */

type Kind = "grn" | "scc" | "invoice";

export default function ReceivingDesk() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [desk, setDesk] = useState<Desk | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<{ po: ReceivableOrder; kind: Kind } | null>(null);
  const [noteErrors, setNoteErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<VendorInvoice | null>(null);

  useEffect(() => {
    let alive = true;
    procurement.receiving.desk().then(
      (d) => {
        if (!alive) return;
        setDesk(d);
        setError(null);
      },
      (e: unknown) => alive && setError(`The receiving desk didn't load. ${opsError(e)}`),
    );
    return () => {
      alive = false;
    };
  }, [reload]);

  /* The order's own page is offered to those who may read orders; the desk itself needs only its own keys. */
  const seesOrders = mayUseOperations(user, "purchase_orders");

  const can = {
    grn: mayDoOps(user, "receiving", "create_grn"),
    scc: mayDoOps(user, "receiving", "create_scc"),
    approveGrn: mayDoOps(user, "receiving", "approve_grn"),
    approveScc: mayDoOps(user, "receiving", "approve_scc"),
    invoice: mayDoOps(user, "receiving", "create_invoice"),
    reject: mayDoOps(user, "receiving", "reject_invoice"),
  };
  const memoHref = (memoId: string) => (mayUseFinance(user, "memos") ? `/suite/finance/memos/${memoId}` : null);

  const toInvoiceIds = useMemo(() => new Set((desk?.toInvoice ?? []).map((o) => o.id)), [desk]);

  const approve = async (kind: "grn" | "scc", note: Grn | Scc) => {
    const ok = await confirm({
      title: `Approve ${note.number ?? (kind === "grn" ? "this GRN" : "this certificate")}?`,
      body:
        kind === "grn"
          ? "What was accepted is added to the order's received quantities, so it can be invoiced and paid."
          : "The service is confirmed on the order, so it can be invoiced and paid.",
      confirmLabel: kind === "grn" ? "Approve the GRN" : "Approve the certificate",
      tone: "primary",
    });
    if (!ok) return;
    setBusy(note.id);
    setNoteErrors((e) => ({ ...e, [note.id]: "" }));
    try {
      if (kind === "grn") await procurement.receiving.approveGrn(note.id);
      else await procurement.receiving.approveScc(note.id);
      setNotice(`${note.number ?? (kind === "grn" ? "GRN" : "Certificate")} approved.`);
      setReload((n) => n + 1);
    } catch (e) {
      setNoteErrors((cur) => ({ ...cur, [note.id]: dutiesRefusal(e) ?? opsError(e) }));
    } finally {
      setBusy(null);
    }
  };

  if (error && !desk)
    return (
      <div>
        <PageHeader title="Receiving & invoices" />
        <LoadError text={error} onRetry={() => setReload((n) => n + 1)} />
      </div>
    );

  if (!desk)
    return (
      <div aria-busy="true" className="space-y-6">
        <p className="sr-only">Loading the receiving desk…</p>
        <Skeleton className="h-20" />
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[132px]" />
          ))}
        </div>
        <Skeleton className="h-[320px]" />
      </div>
    );

  const late = desk.toReceive.filter((o) => isPast(o.deliveryDate));
  const notes = desk.grns.length + desk.sccs.length;

  /* The two order lists on the desk, one row per order. */
  const exportCsv = () =>
    downloadCsv(csvName("receiving"), [
      ["List", "Number", "Vendor", "Type", "Delivery by", "Total", "Currency", "Status", "To invoice before VAT"],
      ...desk.toReceive.map((o) => ["To receive", o.number ?? "", o.vendor ?? "", o.kind === "lso" ? "Services" : "Goods", csvDate(o.deliveryDate), csvAmount(o.total), o.currency, poStatus(o.status).label, ""]),
      ...desk.toInvoice.map((o) => [
        "Ready to invoice",
        o.number ?? "",
        o.vendor ?? "",
        o.kind === "lso" ? "Services" : "Goods",
        csvDate(o.deliveryDate),
        csvAmount(o.total),
        o.currency,
        poStatus(o.status).label,
        csvAmount(o.lines.reduce((s, l) => s + Math.round(Math.max(0, l.toInvoice ?? 0) * l.unitPrice), 0)),
      ]),
    ]);

  return (
    <div>
      <PageHeader
        title="Receiving & invoices"
        subtitle="Record what arrived and what was done, approve someone else's notes, and match the vendor's invoice to the order."
        actions={
          <Button size="sm" icon={Download} onClick={exportCsv} disabled={desk.toReceive.length + desk.toInvoice.length === 0}>
            Download CSV
          </Button>
        }
      />

      <Notice text={notice} />

      <div className="space-y-6">
        <StatGrid>
          <StatCard featured label="Orders to receive" value={desk.toReceive.length} icon={PackageOpen} hint={desk.toReceive.length ? "Approved, sent or part received" : "Nothing on its way"} />
          <StatCard label="Overdue deliveries" value={late.length} icon={CalendarClock} hue={late.length ? "rose" : "mint"} hint={late.length ? "Past their delivery date" : "None late"} />
          <StatCard label="Notes to approve" value={notes} icon={ClipboardCheck} hue={notes ? "sun" : "mint"} hint={`${desk.grns.length} GRN · ${desk.sccs.length} SCC`} />
          <StatCard label="Invoice exceptions" value={desk.exceptions.length} icon={FileWarning} hue={desk.exceptions.length ? "rose" : "mint"} hint={desk.exceptions.length ? "Not paid until resolved" : "All invoices matched"} />
        </StatGrid>

        <div className="grid gap-6 xl:grid-cols-3">
          <Panel className="xl:col-span-2" title="Waiting to be received" subtitle="Soonest delivery first" icon={PackageOpen} hue="sky" bodyClassName="p-0">
            {desk.toReceive.length === 0 ? (
              <Empty icon={Inbox} title="Nothing to receive" hint="Approved orders appear here until everything on them has arrived or been confirmed." hue="mint" />
            ) : (
              <ul className="divide-y divide-neutral-100">
                {desk.toReceive.map((o) => {
                  const overdue = isPast(o.deliveryDate);
                  const goodsLeft = o.lines.some((l) => l.kind === "goods" && (l.outstanding ?? l.quantity - l.received) > 0);
                  const servicesLeft = o.lines.some((l) => l.kind === "service" && (l.outstanding ?? l.quantity - l.received) > 0);
                  return (
                    <li key={o.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-start gap-3">
                        <DateLeaf ymd={o.deliveryDate} late={overdue} />
                        <div className="min-w-0">
                          {seesOrders ? (
                            <Link href={`/suite/operations/procurement/orders/${o.id}`} className="block truncate rounded text-sm font-semibold text-neutral-900 outline-none hover:text-primary-700 focus-visible:ring-2 focus-visible:ring-primary-300">
                              {o.vendor ?? "Vendor"}
                            </Link>
                          ) : (
                            <p className="truncate text-sm font-semibold text-neutral-900">
                              <CounterpartyLink id={o.vendorId} name={o.vendor} fallback="Vendor" />
                            </p>
                          )}
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                            <DocNo value={o.number} />
                            <span>{o.kind === "lso" ? "Services" : "Goods"}</span>
                            <Money value={o.total} currency={o.currency} />
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            <PoStatusChip status={o.status} />
                            {overdue && (
                              <Chip hue="rose" icon={CalendarClock}>
                                Overdue
                              </Chip>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        {goodsLeft && can.grn && (
                          <Button size="sm" variant="primary" icon={PackageCheck} onClick={() => setOpen({ po: o, kind: "grn" })}>
                            Record goods received
                          </Button>
                        )}
                        {servicesLeft && can.scc && (
                          <Button size="sm" variant="primary" icon={ClipboardCheck} onClick={() => setOpen({ po: o, kind: "scc" })}>
                            Confirm the service
                          </Button>
                        )}
                        {toInvoiceIds.has(o.id) && can.invoice && (
                          <Button size="sm" icon={ReceiptText} onClick={() => setOpen({ po: desk.toInvoice.find((x) => x.id === o.id) ?? o, kind: "invoice" })}>
                            Invoice
                          </Button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Waiting for approval" subtitle="Approved by someone other than whoever recorded it" icon={ClipboardCheck} hue="sun">
            {notes === 0 ? (
              <Empty icon={ClipboardCheck} title="No GRNs or certificates waiting" hue="mint" />
            ) : (
              <ul className="space-y-3">
                {desk.grns.map((g) => (
                  <PendingNote
                    key={g.id}
                    kind="GRN"
                    number={g.number}
                    poNumber={g.poNumber}
                    line={`${g.lines.reduce((s, l) => s + l.accepted, 0) ? qty(g.lines.reduce((s, l) => s + l.accepted, 0)) : "Nothing"} accepted · received ${day(g.receivedOn)} by ${g.receivedBy ?? "-"}`}
                    error={noteErrors[g.id]}
                    action={
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <PdfLink href={procurement.receiving.grnPdfUrl(g.id)} label="Print" name={g.number} />
                        {can.approveGrn && (
                          <Button size="sm" variant="primary" icon={BadgeCheck} disabled={busy !== null} onClick={() => void approve("grn", g)}>
                            {busy === g.id ? "Approving…" : "Approve"}
                          </Button>
                        )}
                      </div>
                    }
                  />
                ))}
                {desk.sccs.map((s) => (
                  <PendingNote
                    key={s.id}
                    kind="SCC"
                    number={s.number}
                    poNumber={s.poNumber}
                    line={`Raised by ${s.raisedBy ?? "-"}${s.rating ? ` · rated ${s.rating} of 5` : ""}`}
                    error={noteErrors[s.id]}
                    action={
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                        <PdfLink href={procurement.receiving.sccPdfUrl(s.id)} label="Print" name={s.number} />
                        {can.approveScc && (
                          <Button size="sm" variant="primary" icon={BadgeCheck} disabled={busy !== null} onClick={() => void approve("scc", s)}>
                            {busy === s.id ? "Approving…" : "Approve"}
                          </Button>
                        )}
                      </div>
                    }
                  />
                ))}
              </ul>
            )}
          </Panel>
        </div>

        <Panel title="Ready to invoice" subtitle="Received or confirmed, and not yet on a matched invoice" icon={ReceiptText} hue="coral" bodyClassName="p-0">
          {desk.toInvoice.length === 0 ? (
            <Empty icon={ReceiptText} title="Nothing waiting to be invoiced" hint="Orders appear here once their goods or services are approved." hue="coral" />
          ) : (
            <ul className="divide-y divide-neutral-100">
              {desk.toInvoice.map((o) => {
                const ready = o.lines.reduce((s, l) => s + Math.round(Math.max(0, l.toInvoice ?? 0) * l.unitPrice), 0);
                return (
                  <li key={o.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-neutral-900">
                        <CounterpartyLink id={o.vendorId} name={o.vendor} fallback="Vendor" />
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <DocNo value={o.number} />
                        <span>
                          {o.lines
                            .filter((l) => (l.toInvoice ?? 0) > 0)
                            .map((l) => `line ${l.lineNo}: ${qty(l.toInvoice)} ${l.unit}`)
                            .join(" · ")}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-right text-xs text-neutral-500">
                        about <Money value={ready} currency={o.currency} className="text-sm font-bold text-neutral-900" />
                        <span className="block">before VAT</span>
                      </span>
                      {can.invoice && (
                        <Button size="sm" variant="primary" icon={ReceiptText} onClick={() => setOpen({ po: o, kind: "invoice" })}>
                          Record the invoice
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Invoice exceptions" subtitle="Invoices that don't agree with the order or what was received" icon={FileWarning} hue="rose">
          {desk.exceptions.length === 0 ? (
            <Empty icon={BadgeCheck} title="No exceptions" hint="Every invoice recorded so far matched." hue="mint" />
          ) : (
            <div className="space-y-3">
              {desk.exceptions.map((inv) => (
                <InvoiceMatch
                  key={inv.id}
                  invoice={inv}
                  memoHref={memoHref}
                  actions={
                    can.reject ? (
                      <Button size="sm" variant="danger" icon={XCircle} onClick={() => setRejecting(inv)}>
                        Reject invoice
                      </Button>
                    ) : null
                  }
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Recently matched" subtitle="Their payment memos are with the FCU" icon={ReceiptText} hue="mint">
          {desk.recentInvoices.length === 0 ? (
            <Empty icon={ReceiptText} title="No invoices matched yet" hint="Record a vendor's invoice against an order once its goods or services are approved." hue="mint" />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {desk.recentInvoices.map((inv) => (
                <InvoiceMatch key={inv.id} invoice={inv} memoHref={memoHref} />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {open?.kind === "grn" && (
        <GrnDialog
          po={open.po}
          stores={desk.stores ?? []}
          onClose={() => setOpen(null)}
          onDone={(g) => {
            setOpen(null);
            setNotice(`${g.number ?? "GRN"} recorded. It now waits for somebody else to approve it.`);
            setReload((n) => n + 1);
          }}
        />
      )}
      {open?.kind === "scc" && (
        <SccDialog
          po={open.po}
          onClose={() => setOpen(null)}
          onDone={(s) => {
            setOpen(null);
            setNotice(`${s.number ?? "Certificate"} raised. It now waits for somebody else to approve it.`);
            setReload((n) => n + 1);
          }}
        />
      )}
      {open?.kind === "invoice" && (
        <InvoiceDialog
          po={open.po}
          memoHref={memoHref}
          onClose={() => setOpen(null)}
          onDone={(inv) => {
            setOpen(null);
            setNotice(inv.status === "matched" ? `Invoice ${inv.invoiceNo} matched${inv.memo?.reference ? `: payment memo ${inv.memo.reference} raised with the FCU` : ""}.` : `Invoice ${inv.invoiceNo} recorded as an exception.`);
            setReload((n) => n + 1);
          }}
        />
      )}
      {rejecting && (
        <ReasonDialog
          title={`Reject invoice ${rejecting.invoiceNo}?`}
          subtitle={`From ${rejecting.vendor ?? "the vendor"} against ${rejecting.poNumber ?? "the order"}. Nothing is paid on it; the vendor sends a corrected invoice, which is recorded afresh. This can't be undone.`}
          label="Resolution"
          hint="What you told the vendor, so the next person knows why."
          confirmLabel="Reject the invoice"
          busyLabel="Rejecting…"
          tone="danger"
          maxLength={2000}
          placeholder="Returned to the vendor: charged 5 laptops, 4 were delivered. Corrected invoice requested."
          onClose={() => setRejecting(null)}
          onConfirm={async (text) => {
            await procurement.receiving.rejectInvoice(rejecting.id, text);
            setRejecting(null);
            setNotice(`Invoice ${rejecting.invoiceNo} rejected.`);
            setReload((n) => n + 1);
          }}
        />
      )}
    </div>
  );
}

function DateLeaf({ ymd, late }: { ymd: string | null; late: boolean }) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const [, m, d] = (ymd ?? "").split("-").map(Number);
  return (
    <span
      className={cx(
        "flex w-12 shrink-0 flex-col items-center rounded-2xl border py-1.5 text-center",
        late ? "border-rose-500/40 bg-rose-50 text-rose-700" : "border-primary-100 bg-primary-50/60 text-neutral-900",
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Due</span>
      <span className="text-lg font-bold leading-tight tabular-nums">{d || "-"}</span>
      <span className="text-[10px] font-medium opacity-80">{m ? months[m - 1] : ""}</span>
      <span className="sr-only">{ymd ? `Due ${day(ymd)}${late ? ", overdue" : ""}` : "No delivery date"}</span>
    </span>
  );
}

function PendingNote({
  kind,
  number,
  poNumber,
  line,
  error,
  action,
}: {
  kind: "GRN" | "SCC";
  number: string | null;
  poNumber?: string | null;
  line: string;
  error?: string;
  action: React.ReactNode;
}) {
  return (
    <li className="rounded-2xl border border-neutral-100 bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-2">
            <Chip hue={kind === "GRN" ? "mint" : "grape"} className="!px-2 !py-0.5 !text-[10px]">
              {kind}
            </Chip>
            <DocNo value={number ?? `Draft ${kind}`} className="text-neutral-800" />
          </p>
          {poNumber && <p className="mt-0.5 font-mono text-[11px] text-neutral-500">on {poNumber}</p>}
          <p className="mt-1 text-xs text-neutral-600">{line}</p>
        </div>
        {action}
      </div>
      {error && <ErrorNote className="mt-2">{error}</ErrorNote>}
    </li>
  );
}
